import express, { type Request, type Response, type NextFunction } from 'express';
import { Connection } from '@solana/web3.js';
import { SuiClient } from '@mysten/sui/client';
import { JsonRpcProvider } from 'ethers';
import {fetchQuote, type Quote, type QuoteParams, type QuoteOptions, addresses} from '@mayanfinance/swap-sdk';
import { verifyQuoteSignature } from './utils/signature';
import { buildTransaction, type BuilderConnections } from './builders';
import { getPermitParams, getHyperCorePermitParams } from './utils/hypercore';
import { apiKeyMiddleware, getMetrics, startRateLimitCleanup, getApiKeyConfig } from './middleware/apiKey';
import type {
  SignedQuote,
  BuildTransactionRequest,
  BuildTransactionResponse,
  ErrorResponse,
  ServerConfig,
  BuildEvmTxParams,
  BuildSvmTxParams,
  BuildSuiTxParams,
  PermitParamsRequest,
  PermitParamsResponse,
  HyperCorePermitParamsRequest,
  HyperCorePermitParamsResponse,
  FetchQuoteRequest,
  FetchQuoteResponse,
} from './types';
import { getChainCategory } from './types';

// Error codes
const ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  BUILD_FAILED: 'BUILD_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Recursively convert BigInt values to strings for JSON serialization
 */
function serializeBigInts(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts);
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value);
    }
    return result;
  }
  return obj;
}

export function createServer(config: ServerConfig) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Apply API key middleware for authentication and rate limiting
  // Note: /quote endpoint is exempt from rate limiting, but still tracked in metrics
  const apiKeyConfig = getApiKeyConfig();
  app.use(apiKeyMiddleware(apiKeyConfig));

  // Initialize connections
  const connections: BuilderConnections = {
    solana: new Connection(config.solanaRpcUrl, 'confirmed'),
    fogo: new Connection(config.fogoRpcUrl, 'confirmed'),
    sui: new SuiClient({ url: config.suiRpcUrl }),
  };

  // Get EVM provider by chain ID
  const getEvmProvider = (chainId: number): JsonRpcProvider => {
    const rpcUrl = config.evmRpcUrls[chainId];
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for chain ID ${chainId}`);
    }
    return new JsonRpcProvider(rpcUrl);
  };

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get forwarder address for ERC20 approvals
  app.get('/forwarder-address', (_req: Request, res: Response) => {
    res.json({
      success: true,
      forwarderAddress: addresses.MAYAN_FORWARDER_CONTRACT,
      description: 'Mayan Forwarder contract address. Approve this address to spend your ERC20 tokens before swapping.',
    });
  });

  // Prometheus metrics endpoint
  app.get('/metrics', async (_req: Request, res: Response) => {
    try {
      res.set('Content-Type', 'text/plain');
      res.send(await getMetrics());
    } catch (error) {
      res.status(500).send('Error collecting metrics');
    }
  });

  // Fetch quote endpoint
  app.post('/quote', async (req: Request, res: Response<FetchQuoteResponse | ErrorResponse>) => {
    try {
      const body = req.body as FetchQuoteRequest;

      // Validate required fields
      const validationError = validateQuoteRequest(body);
      if (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError,
          code: ERROR_CODES.INVALID_REQUEST,
        });
      }

      // Build QuoteParams from flat request
      const quoteParams: QuoteParams = {
        fromToken: body.fromToken,
        fromChain: body.fromChain,
        toToken: body.toToken,
        toChain: body.toChain,
        slippageBps: body.slippageBps,
      };

      // Add amount (prefer amountIn64)
      if (body.amountIn64) {
        quoteParams.amountIn64 = body.amountIn64;
      } else if (body.amount !== undefined) {
        quoteParams.amount = body.amount;
      }

      // Add optional params
      if (body.gasDrop !== undefined) quoteParams.gasDrop = body.gasDrop;
      if (body.referrer) quoteParams.referrer = body.referrer;
      if (body.referrerBps !== undefined) quoteParams.referrerBps = body.referrerBps;

      // Build QuoteOptions from flat request
      const quoteOptions: QuoteOptions = {};
      if (body.wormhole !== undefined) quoteOptions.wormhole = body.wormhole;
      if (body.swift !== undefined) quoteOptions.swift = body.swift;
      if (body.mctp !== undefined) quoteOptions.mctp = body.mctp;
      if (body.shuttle !== undefined) quoteOptions.shuttle = body.shuttle;
      if (body.fastMctp !== undefined) quoteOptions.fastMctp = body.fastMctp;
      if (body.gasless !== undefined) quoteOptions.gasless = body.gasless;
      if (body.onlyDirect !== undefined) quoteOptions.onlyDirect = body.onlyDirect;
      if (body.fullList !== undefined) quoteOptions.fullList = body.fullList;
      if (body.payload) quoteOptions.payload = body.payload;
      if (body.monoChain !== undefined) quoteOptions.monoChain = body.monoChain;

      // Fetch quotes
      const quotes = await fetchQuote(quoteParams, quoteOptions);

      return res.json({
        success: true,
        quotes: serializeBigInts(quotes) as Quote[],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Fetch quote error:', error);
      return res.status(500).json({
        success: false,
        error: message,
        code: ERROR_CODES.INTERNAL_ERROR,
      });
    }
  });

  // Build transaction endpoint
  app.post('/build', async (req: Request, res: Response<BuildTransactionResponse | ErrorResponse>) => {
    try {
      const body = req.body as BuildTransactionRequest;

      // Validate request structure
      const validationError = validateRequest(body);
      if (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError,
          code: ERROR_CODES.INVALID_REQUEST,
        });
      }

      const quote = body.quote;

      // Verify quote signature
      if (!verifyQuoteSignature(quote, config.expectedSignerAddress)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature for quote',
          code: ERROR_CODES.INVALID_SIGNATURE,
        });
      }

      // Validate that params match the chain category
      const paramsError = validateParamsForChain(quote, body.params);
      if (paramsError) {
        return res.status(400).json({
          success: false,
          error: paramsError,
          code: ERROR_CODES.INVALID_REQUEST,
        });
      }

      // Build transaction
      const transaction = await buildTransaction(
        quote as Quote,
        body.params,
        connections
      );

      return res.json({
        success: true,
        transaction: serializeBigInts(transaction) as typeof transaction,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Build transaction error:', error);
      return res.status(500).json({
        success: false,
        error: message,
        code: ERROR_CODES.BUILD_FAILED,
      });
    }
  });

  // General permit params endpoint (for ERC20 token allowance)
  app.post('/permit-params', async (req: Request, res: Response<PermitParamsResponse | ErrorResponse>) => {
    try {
      const body = req.body as PermitParamsRequest;

      // Validate request
      if (!body.quote) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: quote',
          code: ERROR_CODES.INVALID_REQUEST,
        });
      }

      if (!body.walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: walletAddress',
          code: ERROR_CODES.INVALID_REQUEST,
        });
      }

      const quote = body.quote;

      // Verify quote signature
      if (!verifyQuoteSignature(quote, config.expectedSignerAddress)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature for quote',
          code: ERROR_CODES.INVALID_SIGNATURE,
        });
      }

      // Get chain ID from token
      const chainId = quote.fromToken.chainId;
      if (!chainId) {
        return res.status(400).json({
          success: false,
          error: 'Quote fromToken does not have chainId',
          code: ERROR_CODES.INVALID_REQUEST,
        });
      }

      // Get provider for the chain
      const provider = getEvmProvider(chainId);

      // Default deadline to 1 hour from now
      const deadline = body.deadline || String(Math.floor(Date.now() / 1000) + 3600);

      // Get permit params
      const permitParams = await getPermitParams(
        quote as Quote,
        body.walletAddress,
        deadline,
        provider
      );

      return res.json({
        success: true,
        permitParams,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Permit params error:', error);
      return res.status(500).json({
        success: false,
        error: message,
        code: ERROR_CODES.BUILD_FAILED,
      });
    }
  });

  // HyperCore permit params endpoint (for USDC deposit on Arbitrum)
  app.post('/hypercore/permit-params', async (req: Request, res: Response<HyperCorePermitParamsResponse | ErrorResponse>) => {
    try {
      const body = req.body as HyperCorePermitParamsRequest;

      // Validate request
      if (!body.quote) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: quote',
          code: ERROR_CODES.INVALID_REQUEST,
        });
      }

      if (!body.userArbitrumAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: userArbitrumAddress',
          code: ERROR_CODES.INVALID_REQUEST,
        });
      }

      const quote = body.quote;

      // Verify quote signature
      if (!verifyQuoteSignature(quote, config.expectedSignerAddress)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature for quote',
          code: ERROR_CODES.INVALID_SIGNATURE,
        });
      }

      // Get Arbitrum provider (chainId 42161)
      const arbProvider = getEvmProvider(42161);

      // Get permit params
      const permitParams = await getHyperCorePermitParams(
        quote as Quote,
        body.userArbitrumAddress,
        arbProvider
      );

      return res.json({
        success: true,
        permitParams,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('HyperCore permit params error:', error);
      return res.status(500).json({
        success: false,
        error: message,
        code: ERROR_CODES.BUILD_FAILED,
      });
    }
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response<ErrorResponse>, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  });

  return app;
}

function validateRequest(body: BuildTransactionRequest): string | null {
  if (!body.quote) {
    return 'Missing required field: quote';
  }

  if (!body.params) {
    return 'Missing required field: params';
  }

  if (!body.params.destinationAddress) {
    return 'Missing required field: params.destinationAddress';
  }

  const quote = body.quote;

  if (!quote.signature) {
    return 'Quote is missing signature';
  }
  if (!quote.fromChain) {
    return 'Quote is missing fromChain';
  }
  if (!quote.type) {
    return 'Quote is missing type';
  }

  return null;
}

function validateParamsForChain(
  quote: SignedQuote,
  params: BuildEvmTxParams | BuildSvmTxParams | BuildSuiTxParams
): string | null {
  const chainCategory = getChainCategory(quote.fromChain);

  // EVM requires signerChainId
  if (chainCategory === 'evm') {
    const evmParams = params as BuildEvmTxParams;
    if (!evmParams.signerChainId) {
      return 'EVM transactions require signerChainId in params';
    }
    if (!evmParams.swapperAddress) {
      return 'EVM transactions require swapperAddress in params';
    }
  }

  // SVM requires swapperAddress
  if (chainCategory === 'svm') {
    const svmParams = params as BuildSvmTxParams;
    if (!svmParams.swapperAddress) {
      return 'SVM transactions require swapperAddress in params';
    }
  }

  // SUI requires swapperAddress
  if (chainCategory === 'sui') {
    const suiParams = params as BuildSuiTxParams;
    if (!suiParams.swapperAddress) {
      return 'SUI transactions require swapperAddress in params';
    }
  }

  return null;
}

function validateQuoteRequest(body: FetchQuoteRequest): string | null {
  const missingFields: string[] = [];

  if (!body.fromToken) missingFields.push('fromToken');
  if (!body.fromChain) missingFields.push('fromChain');
  if (!body.toToken) missingFields.push('toToken');
  if (!body.toChain) missingFields.push('toChain');
  if (body.slippageBps === undefined) missingFields.push('slippageBps');

  if (missingFields.length > 0) {
    return `Missing required fields: ${missingFields.join(', ')}`;
  }

  // Validate amount - at least one is required
  if (body.amount === undefined && !body.amountIn64) {
    return 'Missing required field: amount or amountIn64 (amountIn64 is recommended for precision)';
  }

  // Validate slippageBps
  if (body.slippageBps !== 'auto' && typeof body.slippageBps !== 'number') {
    return 'slippageBps must be "auto" or a number (basis points, e.g., 50 = 0.5%)';
  }

  return null;
}

export function startServer(config: ServerConfig) {
  const app = createServer(config);

  // Start rate limit cleanup interval
  const cleanupInterval = startRateLimitCleanup();

  const server = app.listen(config.port, () => {
    const apiKeyConfig = getApiKeyConfig();
    console.log(`Mayan TX Builder API running on port ${config.port}`);
    console.log(`   Health check: http://localhost:${config.port}/health`);
    console.log(`   Metrics: http://localhost:${config.port}/metrics`);
    console.log(`   Quote endpoint: POST http://localhost:${config.port}/quote`);
    console.log(`   Build endpoint: POST http://localhost:${config.port}/build`);
    console.log(`   API Key auth: ${apiKeyConfig.enabled ? 'enabled' : 'disabled'}`);
    if (apiKeyConfig.enabled) {
      console.log(`   Rate limit: ${apiKeyConfig.rateLimit.maxRequests} requests per ${apiKeyConfig.rateLimit.windowMs / 1000}s`);
    }
  });

  // Cleanup on server close
  server.on('close', () => {
    clearInterval(cleanupInterval);
  });

  return app;
}

