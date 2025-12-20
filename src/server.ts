import express, { type Request, type Response, type NextFunction } from 'express';
import { Connection } from '@solana/web3.js';
import { SuiClient } from '@mysten/sui/client';
import type { Quote } from '@mayanfinance/swap-sdk';
import { validateQuotes } from './utils/signature';
import { buildTransactions, type BuilderConnections } from './builders';
import type {
  SignedQuote,
  BuildTransactionRequest,
  BuildTransactionResponse,
  ErrorResponse,
  ServerConfig,
  BuildEvmTxParams,
  BuildSvmTxParams,
  BuildSuiTxParams,
  ChainCategory,
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

  // Initialize connections
  const connections: BuilderConnections = {
    solana: new Connection(config.solanaRpcUrl, 'confirmed'),
    fogo: new Connection(config.fogoRpcUrl, 'confirmed'),
    sui: new SuiClient({ url: config.suiRpcUrl }),
  };

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

      // Normalize quotes to array
      const quotes: SignedQuote[] = Array.isArray(body.quotes) ? body.quotes : [body.quotes];

      // Verify all quote signatures
      const { valid, invalidIndexes } = validateQuotes(quotes, config.expectedSignerAddress);
      if (!valid) {
        return res.status(401).json({
          success: false,
          error: `Invalid signature for quote(s) at index: ${invalidIndexes.join(', ')}`,
          code: ERROR_CODES.INVALID_SIGNATURE,
        });
      }

      // Validate that params match the chain category
      const paramsError = validateParamsForChain(quotes, body.params);
      if (paramsError) {
        return res.status(400).json({
          success: false,
          error: paramsError,
          code: ERROR_CODES.INVALID_REQUEST,
        });
      }

      // Build transactions
      const transactions = await buildTransactions(
        quotes as Quote[],
        body.params,
        connections
      );

      return res.json({
        success: true,
        transactions: serializeBigInts(transactions) as typeof transactions,
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
  if (!body.quotes) {
    return 'Missing required field: quotes';
  }

  if (!body.params) {
    return 'Missing required field: params';
  }

  if (!body.params.destinationAddress) {
    return 'Missing required field: params.destinationAddress';
  }

  const quotes = Array.isArray(body.quotes) ? body.quotes : [body.quotes];
  
  if (quotes.length === 0) {
    return 'quotes array cannot be empty';
  }

  for (let i = 0; i < quotes.length; i++) {
    const quote = quotes[i];
    if (!quote.signature) {
      return `Quote at index ${i} is missing signature`;
    }
    if (!quote.fromChain) {
      return `Quote at index ${i} is missing fromChain`;
    }
    if (!quote.type) {
      return `Quote at index ${i} is missing type`;
    }
  }

  return null;
}

function validateParamsForChain(
  quotes: SignedQuote[],
  params: BuildEvmTxParams | BuildSvmTxParams | BuildSuiTxParams
): string | null {
  // All quotes should be from same chain category
  const categories = new Set(quotes.map(q => getChainCategory(q.fromChain)));
  if (categories.size > 1) {
    return 'All quotes must be from the same chain category (evm, svm, or sui)';
  }

  const chainCategory = getChainCategory(quotes[0].fromChain);

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

export function startServer(config: ServerConfig) {
  const app = createServer(config);
  
  app.listen(config.port, () => {
    console.log(`🚀 Mayan TX Builder API running on port ${config.port}`);
    console.log(`   Health check: http://localhost:${config.port}/health`);
    console.log(`   Build endpoint: POST http://localhost:${config.port}/build`);
  });

  return app;
}

