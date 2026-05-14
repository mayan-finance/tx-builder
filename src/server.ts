import express, { type Request, type Response, type NextFunction } from 'express';
import { Connection } from '@solana/web3.js';
import { SuiClient } from '@mysten/sui/client';
import { JsonRpcProvider } from 'ethers';
import {fetchQuote, fetchTokenList, fetchAllTokenList, type Quote, type QuoteParams, type QuoteOptions, type ChainName, type TokenStandard, addresses} from '@mayanfinance/swap-sdk';
import { verifyQuoteSignature } from './utils/signature';
import { buildTransaction, type BuilderConnections } from './builders';
import { getPermitParams, getHyperCorePermitParams } from './utils/hypercore';
import { metricsMiddleware, getMetrics } from './middleware/apiKey';
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
  FetchTokensResponse,
  FetchAllTokensResponse,
} from './types';
import { getChainCategory, VALID_TOKEN_STANDARDS } from './types';

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

  // CORS middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Apply metrics middleware
  app.use(metricsMiddleware());

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

  // Fetch token list for a single chain
  // Wraps SDK fetchTokenList(chain, nonPortal?, tokenStandards?, apiKey?)
  app.get('/tokens', async (req: Request, res: Response<FetchTokensResponse | ErrorResponse>) => {
    try {
      const chain = req.query.chain as ChainName | undefined;
      if (!chain) {
        return res.status(400).json({
          success: false,
          error: 'Missing required query param: chain',
          code: ERROR_CODES.INVALID_REQUEST,
        });
      }

      const standardsError = parseTokenStandards(req.query.tokenStandards);
      if ('error' in standardsError) {
        return res.status(400).json({
          success: false,
          error: standardsError.error,
          code: ERROR_CODES.INVALID_REQUEST,
        });
      }

      const nonPortal = req.query.nonPortal !== undefined
        ? req.query.nonPortal === 'true'
        : undefined;

      const apiKey = req.headers['x-api-key'] as string | undefined;
      const tokens = await fetchTokenList(chain, nonPortal, standardsError.value, apiKey);

      return res.json({ success: true, tokens });
    } catch (error) {
      return handleSdkError(error, res, 'Fetch tokens error');
    }
  });

  // Fetch token list across every chain, keyed by chain name
  // Wraps SDK fetchAllTokenList(tokenStandards?, apiKey?)
  app.get('/tokens/all', async (req: Request, res: Response<FetchAllTokensResponse | ErrorResponse>) => {
    try {
      const standardsError = parseTokenStandards(req.query.tokenStandards);
      if ('error' in standardsError) {
        return res.status(400).json({
          success: false,
          error: standardsError.error,
          code: ERROR_CODES.INVALID_REQUEST,
        });
      }

      const apiKey = req.headers['x-api-key'] as string | undefined;
      const tokens = await fetchAllTokenList(standardsError.value, apiKey);

      return res.json({ success: true, tokens });
    } catch (error) {
      return handleSdkError(error, res, 'Fetch all tokens error');
    }
  });

  function handleSdkError(
    error: unknown,
    res: Response<ErrorResponse>,
    logPrefix: string,
  ) {
    console.error(`${logPrefix}:`, error);

    const sdkError = error as { code?: string | number; message?: string; msg?: string; data?: unknown };
    const sdkMessage = sdkError.message || sdkError.msg || 'Unknown error';
    if (sdkError.code !== undefined) {
      return res.status(400).json({
        success: false,
        error: sdkMessage,
        code: String(sdkError.code),
        ...(sdkError.data !== undefined && { data: sdkError.data }),
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }

  // Fetch quote endpoint (GET — query params only, no extraInstructions support)
  app.get('/quote', async (req: Request, res: Response<FetchQuoteResponse | ErrorResponse>) => {
    const query = req.query;

    // extraInstructions / solanaBridgeOptions cannot be expressed as query params.
    // Reject up-front with a clear pointer to POST /quote, since callers might
    // try to pass them as JSON strings.
    if (query.extraInstructions !== undefined || query.solanaBridgeOptions !== undefined) {
      return res.status(400).json({
        success: false,
        error: 'extraInstructions and solanaBridgeOptions are not supported on GET /quote — they require structured JSON. Use POST /quote with a JSON body instead.',
        code: ERROR_CODES.INVALID_REQUEST,
      });
    }

    const body: FetchQuoteRequest = {
      fromToken: query.fromToken as string,
      fromChain: query.fromChain as FetchQuoteRequest['fromChain'],
      toToken: query.toToken as string,
      toChain: query.toChain as FetchQuoteRequest['toChain'],
      slippageBps: query.slippageBps === 'auto' ? 'auto' : Number(query.slippageBps),
      amount: query.amount !== undefined ? Number(query.amount) : undefined,
      amountIn64: query.amountIn64 as string | undefined,
      gasDrop: query.gasDrop !== undefined ? Number(query.gasDrop) : undefined,
      referrer: query.referrer as string | undefined,
      referrerBps: query.referrerBps !== undefined ? Number(query.referrerBps) : undefined,
      wormhole: query.wormhole !== undefined ? query.wormhole === 'true' : undefined,
      swift: query.swift !== undefined ? query.swift === 'true' : undefined,
      mctp: query.mctp !== undefined ? query.mctp === 'true' : undefined,
      shuttle: query.shuttle !== undefined ? query.shuttle === 'true' : undefined,
      fastMctp: query.fastMctp !== undefined ? query.fastMctp === 'true' : undefined,
      gasless: query.gasless !== undefined ? query.gasless === 'true' : undefined,
      onlyDirect: query.onlyDirect !== undefined ? query.onlyDirect === 'true' : undefined,
      fullList: query.fullList !== undefined ? query.fullList === 'true' : undefined,
      payload: query.payload as string | undefined,
      monoChain: query.monoChain !== undefined ? query.monoChain === 'true' : undefined,
      memoHex: query.memoHex as string | undefined,
    };

    return handleFetchQuote(body, req, res);
  });

  // Fetch quote endpoint (POST — JSON body, supports extraInstructions and solanaBridgeOptions)
  app.post('/quote', async (req: Request, res: Response<FetchQuoteResponse | ErrorResponse>) => {
    const body = (req.body ?? {}) as FetchQuoteRequest;
    return handleFetchQuote(body, req, res);
  });

  async function handleFetchQuote(
    body: FetchQuoteRequest,
    req: Request,
    res: Response<FetchQuoteResponse | ErrorResponse>,
  ) {
    try {
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
      const quoteOptions: QuoteOptions = {
        apiKey: req.headers['x-api-key'] as string | undefined,
      };
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
      if (body.memoHex) quoteOptions.memoHex = body.memoHex;

      // POST-only options
      if (body.extraInstructions) {
        quoteOptions.extraInstructions = body.extraInstructions;
      }
      if (body.solanaBridgeOptions) {
        const { customPayload, ...rest } = body.solanaBridgeOptions;
        quoteOptions.solanaBridgeOptions = {
          ...rest,
          // SDK accepts Buffer | Uint8Array; convert from hex string for wire transport
          customPayload: customPayload ? Buffer.from(customPayload, 'hex') : undefined,
        };
      }

      // Fetch quotes
      const quotes = await fetchQuote(quoteParams, quoteOptions);

      return res.json({
        success: true,
        quotes: serializeBigInts(quotes) as Quote[],
      });
    } catch (error) {
      console.error('Fetch quote error:', error);

      // Handle SDK errors which have { code, message, data? } format
      const sdkError = error as { code?: string | number; message?: string; msg?: string; data?: unknown };
      const sdkErrorMessage = sdkError.message || sdkError.msg || 'Unknown error';
      if (sdkError.code !== undefined) {
        return res.status(400).json({
          success: false,
          error: sdkErrorMessage,
          code: String(sdkError.code),
          ...(sdkError.data !== undefined && { data: sdkError.data }),
        });
      }

      // Handle standard Error objects
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        error: message,
        code: ERROR_CODES.INTERNAL_ERROR,
      });
    }
  }

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
        connections,
        req.headers['x-api-key'] as string | undefined
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

// Parse the tokenStandards query param. Accepts a comma-separated string
// (?tokenStandards=erc20,native) or a repeated key (?tokenStandards=erc20&tokenStandards=native).
// Returns { value } for the parsed array (or undefined when omitted) or { error } on a bad value.
function parseTokenStandards(
  raw: unknown,
): { value: TokenStandard[] | undefined } | { error: string } {
  if (raw === undefined) return { value: undefined };

  let parts: string[];
  if (Array.isArray(raw)) {
    parts = raw.flatMap((v) => String(v).split(','));
  } else {
    parts = String(raw).split(',');
  }

  const standards = parts.map((s) => s.trim()).filter((s) => s.length > 0);
  if (standards.length === 0) return { value: undefined };

  const invalid = standards.filter((s) => !VALID_TOKEN_STANDARDS.includes(s as TokenStandard));
  if (invalid.length > 0) {
    return {
      error: `Invalid tokenStandards: ${invalid.join(', ')}. Allowed: ${VALID_TOKEN_STANDARDS.join(', ')}.`,
    };
  }

  return { value: standards as TokenStandard[] };
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

/**
 * Create a separate Express app for Prometheus metrics
 * This runs on a different port for security (not exposed publicly)
 */
export function createMetricsServer() {
  const metricsApp = express();

  // Health check for metrics server
  metricsApp.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Prometheus metrics endpoint
  metricsApp.get('/metrics', async (_req: Request, res: Response) => {
    try {
      res.set('Content-Type', 'text/plain');
      res.send(await getMetrics());
    } catch (error) {
      res.status(500).send('Error collecting metrics');
    }
  });

  return metricsApp;
}

export function startServer(config: ServerConfig) {
  const app = createServer(config);
  const metricsApp = createMetricsServer();

  // Start main API server
  const server = app.listen(config.port, () => {
    console.log(`Mayan TX Builder API running on port ${config.port}`);
    console.log(`   Health check: http://localhost:${config.port}/health`);
    console.log(`   Quote endpoint: GET/POST http://localhost:${config.port}/quote`);
    console.log(`   Tokens endpoint: GET http://localhost:${config.port}/tokens?chain=…`);
    console.log(`   All tokens endpoint: GET http://localhost:${config.port}/tokens/all`);
    console.log(`   Build endpoint: POST http://localhost:${config.port}/build`);
  });

  // Start metrics server on separate port
  const metricsServer = metricsApp.listen(config.metricsPort, () => {
    console.log(`Prometheus metrics server running on port ${config.metricsPort}`);
    console.log(`   Metrics: http://localhost:${config.metricsPort}/metrics`);
  });

  // Cleanup on server close
  server.on('close', () => {
    metricsServer.close();
  });

  return app;
}

