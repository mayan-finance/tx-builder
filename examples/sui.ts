/**
 * Sui Transaction Examples
 * 
 * Tests:
 * 1. MCTP: Sui -> Solana (USDC)
 * 2. MCTP: Sui -> Base (USDC)
 */

import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const SERVER_URL = 'https://tx-builder.mayan.finance';
const SUI_RPC_URL = process.env.SUI_RPC_URL || 'https://fullnode.mainnet.sui.io:443';

const suiClient = new SuiClient({ url: SUI_RPC_URL });

let keypair: Ed25519Keypair | undefined;
if (process.env.SUI_PRIVATE_KEY) {
  try {
    const { secretKey } = decodeSuiPrivateKey(process.env.SUI_PRIVATE_KEY);
    keypair = Ed25519Keypair.fromSecretKey(secretKey);
    console.log('Wallet loaded:', keypair.getPublicKey().toSuiAddress());
  } catch (e) {
    console.error('Failed to load keypair:', e);
  }
}

const ADDRESSES = {
  evm: '0xEab4Fb2De5a05Ba392eB2614bd2293592d455A4f',
  solana: '6riUFsScbBHa6T14SfLC19AXAHgE8A5JuZwn2g7QZN73',
  sui: '0x10649cdcee564178674f4fe719e5a8f48d6cc779684e022345ec16aacaf7b040',
};

const TOKENS = {
  usdc_base: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  usdc_solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  usdc_sui: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
  sui_native: '0x2::sui::SUI',
  eth_base: '0x0000000000000000000000000000000000000000',
};

async function fetchQuote(params: {
  fromToken: string;
  fromChain: string;
  toToken: string;
  toChain: string;
  amountIn: number;
  swift?: boolean;
  mctp?: boolean;
  fastMctp?: boolean;
}): Promise<any> {
  const queryParams = new URLSearchParams({
    amountIn: params.amountIn.toString(),
    fromToken: params.fromToken,
    fromChain: params.fromChain,
    toToken: params.toToken,
    toChain: params.toChain,
    slippageBps: 'auto',
    swift: (params.swift ?? false).toString(),
    mctp: (params.mctp ?? false).toString(),
    fastMctp: (params.fastMctp ?? false).toString(),
    monoChain: 'false',
    gasless: 'false',
    wormhole: 'false',
    shuttle: 'false',
    onlyDirect: 'false',
    fullList: 'false',
    solanaProgram: 'FC4eXxkyrMPTjiYUpp4EAnkmwMbQyZ6NDCh1kfLn6vsf',
    forwarderAddress: '0x337685fdaB40D39bd02028545a4FfA7D287cC3E2',
    referrer: '7HN4qCvG2dP5oagZRxj2dTGPhksgRnKCaLPjtjKEr1Ho',
    sdkVersion: '12_2_3',
  });

  const url = `https://price-api.mayan.finance/v3/quote?${queryParams}`;
  console.log(`Fetching: ${params.fromChain} -> ${params.toChain}`);
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Quote fetch failed: ${response.status}`);
  
  const data = await response.json();
  if (!data.quotes?.length) throw new Error('No quotes available');
  
  console.log(`Got ${data.quotes[0].type} quote`);
  return data.quotes[0];
}

async function buildTransaction(quote: any, params: any): Promise<any> {
  const response = await fetch(`${SERVER_URL}/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quotes: quote, params }),
  });
  
  const result = await response.json();
  if (!result.success) throw new Error(`Build failed: ${result.error}`);
  return result;
}

async function executeTransaction(result: any): Promise<string | null> {
  if (!keypair || process.env.EXECUTE !== 'true') {
    return null;
  }

  const txData = result.transactions[0];
  if (txData.chainCategory !== 'sui' || !txData.transaction) {
    return null;
  }

  // Decode base64 transaction
  const txBytes = Uint8Array.from(Buffer.from(txData.transaction, 'base64'));
  const transaction = Transaction.from(txBytes);

  // Sign and execute transaction
  const txResult = await suiClient.signAndExecuteTransaction({
    signer: keypair,
    transaction,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  console.log('📤 Tx sent:', txResult.digest);

  // Wait for confirmation
  const confirmation = await suiClient.waitForTransaction({
    digest: txResult.digest,
    options: { showEffects: true },
  });

  if (confirmation.effects?.status?.status !== 'success') {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.effects?.status)}`);
  }
  console.log('✅ Confirmed');

  return txResult.digest;
}

// MCTP: Sui -> Solana
async function testMctpSuiToSolana() {
  console.log('\n=== MCTP: Sui -> Solana ===');
  
  const quote = await fetchQuote({
    fromToken: TOKENS.usdc_sui,
    fromChain: 'sui',
    toToken: TOKENS.usdc_solana,
    toChain: 'solana',
    amountIn: 3,
    mctp: true,
  });
  
  const result = await buildTransaction(quote, {
    swapperAddress: ADDRESSES.sui,
    destinationAddress: ADDRESSES.solana,
  });
  
  console.log('✅ Built:', result.transactions[0].quoteType);
  console.log('Tx length:', result.transactions[0].transaction.length, 'bytes (base64)');

  await executeTransaction(result);
  return result;
}

// MCTP: Sui -> Base
async function testMctpSuiToBase() {
  console.log('\n=== MCTP: Sui -> Base ===');
  
  const quote = await fetchQuote({
    fromToken: TOKENS.usdc_sui,
    fromChain: 'sui',
    toToken: TOKENS.usdc_base,
    toChain: 'base',
    amountIn: 3,
    mctp: true,
  });
  
  const result = await buildTransaction(quote, {
    swapperAddress: ADDRESSES.sui,
    destinationAddress: ADDRESSES.evm,
  });
  
  console.log('✅ Built:', result.transactions[0].quoteType);
  console.log('Tx length:', result.transactions[0].transaction.length, 'bytes (base64)');

  await executeTransaction(result);
  return result;
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║        SUI TRANSACTION TESTS         ║');
  console.log('╚══════════════════════════════════════╝');
  
  try {
    await testMctpSuiToSolana(); // tx-hash: 22GUwk4X5KCwNateg2UU4Ttaf1CxdHDcM2J19dj5ZJ64
    await testMctpSuiToBase(); // tx-hash: GoKpuScnVEB1mnEdbuhwpzsFWBrKo5y1HUFYSujQ1aGH
    
    console.log('\n✅ All Sui tests passed!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
