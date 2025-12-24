import type { Quote, Erc20Permit, ReferrerAddresses, ChainName, TokenStandard } from '@mayanfinance/swap-sdk';

// Chain categories for routing
export type ChainCategory = 'evm' | 'svm' | 'sui';

export const EVM_CHAINS: ChainName[] = [
  'ethereum', 'bsc', 'polygon', 'avalanche', 'arbitrum', 
  'optimism', 'base', 'unichain', 'linea', 'sonic', 'hyperevm', 'monad'
];

export const SVM_CHAINS: ChainName[] = ['solana', 'fogo'];

export const SUI_CHAINS: ChainName[] = ['sui'];

export function getChainCategory(chain: ChainName): ChainCategory {
  if (EVM_CHAINS.includes(chain)) return 'evm';
  if (SVM_CHAINS.includes(chain)) return 'svm';
  if (SUI_CHAINS.includes(chain)) return 'sui';
  throw new Error(`Unsupported chain: ${chain}`);
}

// Quote with signature from user
export interface SignedQuote extends Quote {
  signature: string;
}

// Permit for ERC20 tokens
export interface PermitParams extends Erc20Permit {}

// Request types for building transactions
export interface BuildTxBaseParams {
  destinationAddress: string;
  referrerAddresses?: ReferrerAddresses;
  customPayload?: string; // hex encoded
}

export interface BuildEvmTxParams extends BuildTxBaseParams {
  swapperAddress: string;
  signerChainId: number | string;
  permit?: PermitParams;
  usdcPermitSignature?: string;
}

export interface BuildSvmTxParams extends BuildTxBaseParams {
  swapperAddress: string;
  usdcPermitSignature?: string;
}

export interface BuildSuiTxParams extends BuildTxBaseParams {
  swapperAddress: string;
  usdcPermitSignature?: string;
}

// API Request body
export interface BuildTransactionRequest {
  quote: SignedQuote;
  params: BuildEvmTxParams | BuildSvmTxParams | BuildSuiTxParams;
}

// Response types

// Non-gasless EVM: transaction calldata for eth_sendRawTransaction
export interface EvmTransactionResultNonGasless {
  chainCategory: 'evm';
  quoteType: string;
  gasless: false;
  transaction: {
    to: string;
    data: string;
    value: string;
    chainId?: number;
  };
  forwarderParams?: {
    method: string;
    params: unknown[];
  };
}

// Gasless EVM (SWIFT only): typed data for EIP-712 signing
export interface EvmTransactionResultGasless {
  chainCategory: 'evm';
  quoteType: string;
  gasless: true;
  typedData: {
    domain: {
      name: string;
      chainId: number;
      verifyingContract: string;
    };
    types: Record<string, Array<{ name: string; type: string }>>;
    value: Record<string, unknown>;
    primaryType: string;
  };
  orderParams: unknown;
  orderHash: string;
  permitParams: unknown;
}

export type EvmTransactionResult = EvmTransactionResultNonGasless | EvmTransactionResultGasless;

export interface SvmTransactionResult {
  chainCategory: 'svm';
  quoteType: string;
  transaction: string; // base64 encoded serialized transaction
  signers?: string[]; // base58 encoded keypair secrets (for additional signers if any)
  instructions?: SerializedInstruction[]; // deprecated: for backward compatibility
  lookupTables?: string[]; // deprecated: for backward compatibility
  swapMessageV0Params?: {
    messageV0: unknown;
    createTmpTokenAccountIxs: SerializedInstruction[];
    tmpTokenAccountSecretKey: string;
  };
}

export interface SerializedInstruction {
  programId: string;
  keys: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: string; // base64 encoded
}

export interface SuiTransactionResult {
  chainCategory: 'sui';
  quoteType: string;
  transaction: string; // serialized Transaction bytes
}

export type TransactionResult = EvmTransactionResult | SvmTransactionResult | SuiTransactionResult;

export interface BuildTransactionResponse {
  success: true;
  transaction: TransactionResult;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

// Configuration
export interface ServerConfig {
  port: number;
  expectedSignerAddress: string;
  solanaRpcUrl: string;
  fogoRpcUrl: string;
  suiRpcUrl: string;
}

