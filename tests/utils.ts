import { Connection, Keypair, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { ethers } from 'ethers';
import bs58 from 'bs58';

// Server URL - use local by default
export const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// RPC URLs
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const SUI_RPC_URL = process.env.SUI_RPC_URL || 'https://fullnode.mainnet.sui.io:443';

// EVM RPC URLs by chain
export const EVM_RPC_URLS: Record<string, string> = {
  ethereum: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
  base: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  arbitrum: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  optimism: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
  polygon: process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com',
  avalanche: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  bsc: process.env.BSC_RPC_URL || 'https://bsc.llamarpc.com',
};

// Chain IDs
export const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  avalanche: 43114,
  bsc: 56,
};

// Keypairs
export function getSolanaKeypair(): Keypair | null {
  if (!process.env.SOLANA_KEY) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_KEY));
  } catch {
    return null;
  }
}

export function getSuiKeypair(): Ed25519Keypair | null {
  if (!process.env.SUI_KEY) return null;
  try {
    const { secretKey } = decodeSuiPrivateKey(process.env.SUI_KEY);
    return Ed25519Keypair.fromSecretKey(secretKey);
  } catch {
    return null;
  }
}

export function getEvmWallet(chain: string): ethers.Wallet | null {
  if (!process.env.EVM_KEY) return null;
  try {
    const rpcUrl = EVM_RPC_URLS[chain] || EVM_RPC_URLS.ethereum;
    return new ethers.Wallet(process.env.EVM_KEY, new ethers.JsonRpcProvider(rpcUrl));
  } catch {
    return null;
  }
}

// Get addresses from keypairs
export function getAddresses() {
  const solanaKeypair = getSolanaKeypair();
  const suiKeypair = getSuiKeypair();
  const evmWallet = getEvmWallet('base');

  return {
    solana: solanaKeypair?.publicKey.toBase58() || '6riUFsScbBHa6T14SfLC19AXAHgE8A5JuZwn2g7QZN73',
    sui: suiKeypair?.getPublicKey().toSuiAddress() || '0x10649cdcee564178674f4fe719e5a8f48d6cc779684e022345ec16aacaf7b040',
    evm: evmWallet?.address || '0xEab4Fb2De5a05Ba392eB2614bd2293592d455A4f',
  };
}

// Balance checking functions
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

// ERC20 ABI for balanceOf
const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];

export async function getSolanaBalance(tokenAddress: string, walletAddress: string): Promise<bigint> {
  const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
  const wallet = new PublicKey(walletAddress);

  // Native SOL uses zero address in Mayan convention
  if (tokenAddress === NATIVE_TOKEN_ADDRESS) {
    const balance = await connection.getBalance(wallet);
    return BigInt(balance);
  } else {
    // SPL Token balance (including WSOL)
    const mint = new PublicKey(tokenAddress);
    const ata = await getAssociatedTokenAddress(mint, wallet);
    try {
      const accountInfo = await connection.getTokenAccountBalance(ata);
      return BigInt(accountInfo.value.amount);
    } catch {
      return BigInt(0); // Account doesn't exist
    }
  }
}

export async function getSuiBalance(coinType: string, walletAddress: string): Promise<bigint> {
  const suiClient = new SuiClient({ url: process.env.SUI_RPC_URL || 'https://fullnode.mainnet.sui.io:443' });

  // Native SUI uses zero address in Mayan convention
  if (coinType === NATIVE_TOKEN_ADDRESS) {
    const balance = await suiClient.getBalance({ owner: walletAddress });
    return BigInt(balance.totalBalance);
  } else {
    // Other coin types (e.g., 0x...::usdc::USDC)
    const balance = await suiClient.getBalance({ owner: walletAddress, coinType });
    return BigInt(balance.totalBalance);
  }
}

export async function getEvmBalance(tokenAddress: string, walletAddress: string, chain: string): Promise<bigint> {
  const rpcUrl = EVM_RPC_URLS[chain];
  if (!rpcUrl) throw new Error(`No RPC URL for chain: ${chain}`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Native token uses zero address
  if (tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS) {
    const balance = await provider.getBalance(walletAddress);
    return balance;
  } else {
    // ERC20 token balance
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await contract.balanceOf(walletAddress);
    return balance;
  }
}

export async function checkSolanaBalance(tokenAddress: string, walletAddress: string, requiredAmount: bigint): Promise<void> {
  const balance = await getSolanaBalance(tokenAddress, walletAddress);
  if (balance < requiredAmount) {
    const tokenName = tokenAddress === NATIVE_TOKEN_ADDRESS ? 'SOL' : tokenAddress.slice(0, 8) + '...';
    throw new Error(`Insufficient Solana balance: have ${balance.toString()}, need ${requiredAmount.toString()} of ${tokenName}`);
  }
}

export async function checkSuiBalance(coinType: string, walletAddress: string, requiredAmount: bigint): Promise<void> {
  const balance = await getSuiBalance(coinType, walletAddress);
  if (balance < requiredAmount) {
    const tokenName = coinType === NATIVE_TOKEN_ADDRESS ? 'SUI' : coinType.split('::').pop() || coinType;
    throw new Error(`Insufficient Sui balance: have ${balance.toString()}, need ${requiredAmount.toString()} of ${tokenName}`);
  }
}

export async function checkEvmBalance(tokenAddress: string, walletAddress: string, chain: string, requiredAmount: bigint): Promise<void> {
  const balance = await getEvmBalance(tokenAddress, walletAddress, chain);
  if (balance < requiredAmount) {
    const tokenName = tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS ? 'native' : tokenAddress.slice(0, 10) + '...';
    throw new Error(`Insufficient ${chain} balance: have ${balance.toString()}, need ${requiredAmount.toString()} of ${tokenName}`);
  }
}

// Quote fetching - uses local /quote endpoint
export interface QuoteParams {
  fromToken: string;
  fromChain: string;
  toToken: string;
  toChain: string;
  amountIn64: string;
  slippageBps?: string | number;
  swift?: boolean;
  mctp?: boolean;
  fastMctp?: boolean;
  monoChain?: boolean;
}

export async function fetchQuote(params: QuoteParams): Promise<any> {
  const response = await fetch(`${SERVER_URL}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromToken: params.fromToken,
      fromChain: params.fromChain,
      toToken: params.toToken,
      toChain: params.toChain,
      amountIn64: params.amountIn64,
      slippageBps: params.slippageBps ?? 'auto',
      swift: params.swift ?? false,
      mctp: params.mctp ?? false,
      fastMctp: params.fastMctp ?? false,
      monoChain: params.monoChain ?? false,
    }),
  });

  const data = await response.json();
  if (!data.success) throw new Error(`Quote fetch failed: ${data.error}`);
  if (!data.quotes?.length) throw new Error('No quotes available');

  return data.quotes[0];
}

// Build transaction - uses local /build endpoint
export async function buildTransaction(quote: any, params: any): Promise<any> {
  const response = await fetch(`${SERVER_URL}/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quote, params }),
  });

  const result = await response.json();
  if (!result.success) throw new Error(`Build failed: ${result.error}`);
  return result;
}

// Execute Solana transaction
export async function executeSolanaTransaction(result: any): Promise<string | null> {
  const keypair = getSolanaKeypair();
  if (!keypair || process.env.EXECUTE !== 'true') return null;

  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const txData = result.transaction;

  if (txData.chainCategory !== 'svm' || !txData.transaction) return null;

  const txBuffer = Buffer.from(txData.transaction, 'base64');
  const transaction = VersionedTransaction.deserialize(txBuffer);

  // Sign with additional signers if provided
  if (txData.signers?.length > 0) {
    const additionalSigners = txData.signers.map((s: string) =>
      Keypair.fromSecretKey(bs58.decode(s))
    );
    transaction.sign(additionalSigners);
  }

  transaction.sign([keypair]);

  const signature = await connection.sendTransaction(transaction, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  const confirmation = await connection.confirmTransaction(signature, 'confirmed');
  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return signature;
}

// Execute Sui transaction
export async function executeSuiTransaction(result: any): Promise<string | null> {
  const keypair = getSuiKeypair();
  if (!keypair || process.env.EXECUTE !== 'true') return null;

  const suiClient = new SuiClient({ url: SUI_RPC_URL });
  const txData = result.transaction;

  if (txData.chainCategory !== 'sui' || !txData.transaction) return null;

  const txBytes = Uint8Array.from(Buffer.from(txData.transaction, 'base64'));
  const transaction = Transaction.from(txBytes);

  const txResult = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction,
    options: { showEffects: true, showEvents: true },
  });

  const confirmation = await suiClient.waitForTransaction({
    digest: txResult.digest,
    options: { showEffects: true },
  });

  if (confirmation.effects?.status?.status !== 'success') {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.effects?.status)}`);
  }

  return txResult.digest;
}

// Execute EVM transaction
export async function executeEvmTransaction(result: any, chain: string): Promise<string | null> {
  const wallet = getEvmWallet(chain);
  if (!wallet || process.env.EXECUTE !== 'true') return null;

  const txData = result.transaction;
  if (txData.chainCategory !== 'evm' || !txData.transaction) return null;

  const tx = {
    to: txData.transaction.to,
    data: txData.transaction.data,
    value: txData.transaction.value,
    chainId: txData.transaction.chainId,
  };

  const txResponse = await wallet.sendTransaction(tx);
  const receipt = await txResponse.wait();

  return txResponse.hash;
}

// Fetch permit params from the server
export async function fetchPermitParams(quote: any, walletAddress: string, deadline?: string): Promise<any> {
  const response = await fetch(`${SERVER_URL}/permit-params`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quote,
      walletAddress,
      deadline: deadline || String(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
    }),
  });

  const result = await response.json();
  if (!result.success) throw new Error(`Permit params failed: ${result.error}`);
  return result.permitParams;
}

// Sign permit and return permit object for transaction
export async function signPermit(permitParams: any, chain: string): Promise<any> {
  const wallet = getEvmWallet(chain);
  if (!wallet) throw new Error('EVM wallet not available');

  const signature = await wallet.signTypedData(
    permitParams.domain,
    permitParams.types,
    permitParams.value
  );

  const sig = ethers.Signature.from(signature);

  return {
    value: permitParams.value.value,
    deadline: permitParams.value.deadline,
    v: sig.v,
    r: sig.r,
    s: sig.s,
  };
}

// Wait for swap to be indexed on Mayan Explorer
export async function waitForSwapIndexed(sourceTxHash: string, timeoutMs: number = 120000): Promise<any> {
  const startTime = Date.now();
  const url = `https://explorer-api.mayan.finance/v3/swap/order-id/${sourceTxHash}`;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url);

      // If we get a successful response, the swap is indexed
      if (response.ok) {
        const data = await response.json();
        return data;
      }

      // 404 means not indexed yet, keep polling
      // Other 4xx/5xx errors also mean we should keep trying
    } catch (error) {
      // Network errors, keep trying
    }

    // Wait 1 second before next poll to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Swap not indexed after ${timeoutMs}ms: ${sourceTxHash}`);
}
