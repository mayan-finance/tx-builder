import { Connection } from '@solana/web3.js';
import { SuiClient } from '@mysten/sui/client';
import type { Quote } from '@mayanfinance/swap-sdk';
import { 
  getChainCategory, 
  type BuildEvmTxParams, 
  type BuildSvmTxParams, 
  type BuildSuiTxParams,
  type TransactionResult,
  type ChainCategory
} from '../types';
import { buildEvmTransaction } from './evm';
import { buildSvmTransaction } from './svm';
import { buildSuiTransaction } from './sui';

export interface BuilderConnections {
  solana: Connection;
  fogo: Connection;
  sui: SuiClient;
}

/**
 * Build transaction for a quote based on its source chain
 */
export async function buildTransaction(
  quote: Quote,
  params: BuildEvmTxParams | BuildSvmTxParams | BuildSuiTxParams,
  connections: BuilderConnections
): Promise<TransactionResult> {
  const chainCategory = getChainCategory(quote.fromChain);

  switch (chainCategory) {
    case 'evm':
      return buildEvmTransaction(quote, params as BuildEvmTxParams);

    case 'svm':
      const svmConnection = quote.fromChain === 'fogo' 
        ? connections.fogo 
        : connections.solana;
      return buildSvmTransaction(quote, params as BuildSvmTxParams, svmConnection);

    case 'sui':
      return buildSuiTransaction(quote, params as BuildSuiTxParams, connections.sui);

    default:
      throw new Error(`Unsupported chain category: ${chainCategory}`);
  }
}

/**
 * Build transactions for multiple quotes
 */
export async function buildTransactions(
  quotes: Quote[],
  params: BuildEvmTxParams | BuildSvmTxParams | BuildSuiTxParams,
  connections: BuilderConnections
): Promise<TransactionResult[]> {
  const results = await Promise.all(
    quotes.map(quote => buildTransaction(quote, params, connections))
  );
  return results;
}

export { buildEvmTransaction } from './evm';
export { buildSvmTransaction } from './svm';
export { buildSuiTransaction } from './sui';

