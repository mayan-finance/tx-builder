/**
 * Solana Transaction Examples
 * 
 * Tests:
 * 1. Swift: Solana -> Base (USDC)
 * 2. MCTP: Solana -> Base (USDC)
 * 3. Fast MCTP: Solana -> Base (USDC)
 * 4. Monochain: Solana (SOL -> USDC)
 */

import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from 'bs58';

const SERVER_URL = 'https://tx-builder.mayan.finance';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

let keypair: Keypair | undefined;
if (process.env.SOLANA_PRIVATE_KEY) {
  try {
    keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
    console.log('Wallet loaded:', keypair.publicKey.toBase58());
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
  sol_native: 'So11111111111111111111111111111111111111112',
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
  monoChain?: boolean;
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
    monoChain: (params.monoChain ?? false).toString(),
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
  if (txData.chainCategory !== 'svm' || !txData.transaction) {
    return null;
  }

  // Decode base64 transaction
  const txBuffer = Buffer.from(txData.transaction, 'base64');
  const transaction = VersionedTransaction.deserialize(txBuffer);

  // Sign with additional signers if provided
  if (txData.signers && txData.signers.length > 0) {
    const additionalSigners = txData.signers.map((s: string) => 
      Keypair.fromSecretKey(bs58.decode(s))
    );
    transaction.sign(additionalSigners);
  }

  // Sign with user keypair
  transaction.sign([keypair]);

  // Send transaction
  const signature = await connection.sendTransaction(transaction, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  console.log('📤 Tx sent:', signature);

  // Confirm transaction
  const confirmation = await connection.confirmTransaction(signature, 'confirmed');
  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }
  console.log('✅ Confirmed');

  return signature;
}

// Swift: Solana -> Base
async function testSwiftSolanaToBase() {
  console.log('\n=== Swift: Solana -> Base ===');
  
  const quote = await fetchQuote({
    fromToken: TOKENS.usdc_solana,
    fromChain: 'solana',
    toToken: TOKENS.usdc_base,
    toChain: 'base',
    amountIn: 3,
    swift: true,
  });
  
  const result = await buildTransaction(quote, {
    swapperAddress: ADDRESSES.solana,
    destinationAddress: ADDRESSES.evm,
  });
  
  console.log('✅ Built:', result.transactions[0].quoteType);
  console.log('Tx length:', result.transactions[0].transaction.length, 'bytes (base64)');

  await executeTransaction(result);
  return result;
}

// MCTP: Solana -> Base
async function testMctpSolanaToBase() {
  console.log('\n=== MCTP: Solana -> Base ===');
  
  const quote = await fetchQuote({
    fromToken: TOKENS.usdc_solana,
    fromChain: 'solana',
    toToken: TOKENS.usdc_base,
    toChain: 'base',
    amountIn: 3,
    mctp: true,
  });
  
  const result = await buildTransaction(quote, {
    swapperAddress: ADDRESSES.solana,
    destinationAddress: ADDRESSES.evm,
  });
  
  console.log('✅ Built:', result.transactions[0].quoteType);
  console.log('Tx length:', result.transactions[0].transaction.length, 'bytes (base64)');

  await executeTransaction(result);
  return result;
}

// Fast MCTP: Solana -> Base
async function testFastMctpSolanaToBase() {
  console.log('\n=== Fast MCTP: Solana -> Base ===');
  
  const quote = await fetchQuote({
    fromToken: TOKENS.usdc_solana,
    fromChain: 'solana',
    toToken: TOKENS.usdc_base,
    toChain: 'base',
    amountIn: 3,
    fastMctp: true,
  });
  
  const result = await buildTransaction(quote, {
    swapperAddress: ADDRESSES.solana,
    destinationAddress: ADDRESSES.evm,
  });
  
  console.log('✅ Built:', result.transactions[0].quoteType);
  console.log('Tx length:', result.transactions[0].transaction.length, 'bytes (base64)');

  await executeTransaction(result);
  return result;
}

// Monochain: Solana (SOL -> USDC)
async function testMonochainSolana() {
  console.log('\n=== Monochain: Solana ===');
  
  const quote = await fetchQuote({
    fromToken: TOKENS.sol_native,
    fromChain: 'solana',
    toToken: TOKENS.usdc_solana,
    toChain: 'solana',
    amountIn: 0.02,
    monoChain: true,
  });
  
  const result = await buildTransaction(quote, {
    swapperAddress: ADDRESSES.solana,
    destinationAddress: ADDRESSES.solana,
  });
  
  console.log('✅ Built:', result.transactions[0].quoteType);
  console.log('Tx length:', result.transactions[0].transaction.length, 'bytes (base64)');

  await executeTransaction(result);
  return result;
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║      SOLANA TRANSACTION TESTS        ║');
  console.log('╚══════════════════════════════════════╝');
  
  try {
    await testSwiftSolanaToBase(); // tx-hash: 5JKnDf9vzVXMQkKnR7eMjvXhW3RXn2dJSdmyKsd4phYfTSxMbe43jJCKqUQZ6SzPtEbrmx4te3bs9tXwSsdTbibc
    await testMctpSolanaToBase(); // tx-hash: 3BcaXhBLswzzd2fEwkJKuBwKGswn62RVjEuFnwKCSAfnsTfLsRXFVUfMUch1bvEBNpRLmgaqKdDnWokjcX9ErgTw
    await testFastMctpSolanaToBase(); // tx-hash: vft2X4DomApXegkepVWsPkvibXSvCS7pStJo1guYZDBetHGNhgWidQj1SXAQMzzGGMhr4SvkDvYwBdnB53WXYuY
    await testMonochainSolana(); // tx-hash: 3iV5LcPFxxQU3Epk6bpF4dNEPMv9BNgAeNL9mQUn8sJ2R5rvhUjaccvMYP9ApRbnPKYD4ZJg7QYCtRGqqCB2J58m
    
    console.log('\n✅ All Solana tests passed!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
