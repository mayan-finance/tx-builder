import { JsonRpcProvider, Contract } from 'ethers';
import type { Quote } from '@mayanfinance/swap-sdk';
import type {
  PermitTypedDataDomain,
  PermitTypedDataValue,
} from '../types';
import { PermitTypes } from '../types';

// Arbitrum USDC contract address (from swap-sdk addresses.ts)
const ARBITRUM_USDC_CONTRACT = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

// HyperCore bridge contract on Arbitrum (from swap-sdk addresses.ts)
const HC_ARBITRUM_BRIDGE = '0x2df1c51e09aecf9cacb7bc98cb1742757f163df7';

// Mayan forwarder contract (from swap-sdk addresses.ts)
const MAYAN_FORWARDER_CONTRACT = '0x337685fdaB40D39bd02028545a4FfA7D287cC3E2';

// ERC20 ABI for permit-related functions
const ERC20_ABI = [
  'function nonces(address owner) view returns (uint256)',
  'function name() view returns (string)',
  'function version() view returns (string)',
];

/**
 * Get the permit domain for a token
 */
async function getTokenPermitDomain(
  tokenContract: string,
  chainId: number,
  provider: JsonRpcProvider
): Promise<PermitTypedDataDomain> {
  const contract = new Contract(tokenContract, ERC20_ABI, provider);

  let name: string;
  let version: string;

  try {
    [name, version] = await Promise.all([
      contract.name(),
      contract.version(),
    ]);
  } catch {
    // Some tokens don't have version(), try just name
    try {
      name = await contract.name();
      version = '1';
    } catch {
      throw new Error('Token does not support permit (missing name/version)');
    }
  }

  return {
    name,
    version,
    chainId,
    verifyingContract: tokenContract,
  };
}

/**
 * Get general ERC20 permit params for signing
 *
 * This provides the EIP-712 typed data that the user needs to sign
 * to authorize the Mayan forwarder contract to spend their tokens.
 */
export async function getPermitParams(
  quote: Quote,
  walletAddress: string,
  deadline: string,
  provider: JsonRpcProvider
): Promise<{
  domain: PermitTypedDataDomain;
  types: typeof PermitTypes;
  value: PermitTypedDataValue;
}> {
  const token = quote.fromToken;

  // Check if token supports permit
  if (!token.supportsPermit) {
    throw new Error('Token does not support permit');
  }

  // Get chain ID from token
  const chainId = token.chainId;
  if (!chainId) {
    throw new Error('Token chainId is not available');
  }

  // Get domain and nonce in parallel
  const contract = new Contract(token.contract, ERC20_ABI, provider);
  const [domain, nonce] = await Promise.all([
    getTokenPermitDomain(token.contract, chainId, provider),
    contract.nonces(walletAddress),
  ]);

  return {
    domain,
    types: PermitTypes,
    value: {
      owner: walletAddress,
      spender: MAYAN_FORWARDER_CONTRACT,
      value: String(quote.effectiveAmountIn64),
      nonce: String(nonce),
      deadline,
    },
  };
}

/**
 * Get the HyperCore USDC deposit permit params for signing
 *
 * This provides the EIP-712 typed data that the user needs to sign
 * to authorize the HyperCore bridge to spend their USDC on Arbitrum.
 */
export async function getHyperCorePermitParams(
  quote: Quote,
  userArbitrumAddress: string,
  arbProvider: JsonRpcProvider
): Promise<{
  domain: PermitTypedDataDomain;
  types: typeof PermitTypes;
  value: PermitTypedDataValue;
}> {
  // Validate quote has hyperCoreParams
  if (!quote.hyperCoreParams) {
    throw new Error('Quote does not have hyperCoreParams');
  }

  // Validate quote is for HyperCore
  if (quote.toChain !== 'hypercore') {
    throw new Error('Quote toChain is not hypercore');
  }

  // Validate toToken is USDC on Arbitrum
  if (quote.toToken.contract.toLowerCase() !== ARBITRUM_USDC_CONTRACT.toLowerCase()) {
    throw new Error('Quote toToken is not USDC on Arbitrum');
  }

  // Get domain and nonce in parallel
  const contract = new Contract(ARBITRUM_USDC_CONTRACT, ERC20_ABI, arbProvider);
  const [domain, nonce] = await Promise.all([
    getTokenPermitDomain(ARBITRUM_USDC_CONTRACT, 42161, arbProvider),
    contract.nonces(userArbitrumAddress),
  ]);

  return {
    domain,
    types: PermitTypes,
    value: {
      owner: userArbitrumAddress,
      spender: HC_ARBITRUM_BRIDGE,
      value: String(quote.hyperCoreParams.depositAmountUSDC64),
      nonce: String(nonce),
      deadline: String(quote.deadline64),
    },
  };
}