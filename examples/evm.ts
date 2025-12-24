/**
 * EVM Transaction Examples
 * 
 * Tests:
 * 1. Swift: Base -> Solana (USDC)
 * 2. MCTP: Base -> Sui (USDC)
 * 3. Fast MCTP: Base -> Solana (USDC)
 * 4. Monochain: Base (ETH -> USDC)
 * 5. Swift with Permit: Base -> Solana (USDC)
 */

import { ethers } from 'ethers';

const SERVER_URL = 'https://tx-builder.mayan.finance';

const ADDRESSES = {
    evm: '0xEab4Fb2De5a05Ba392eB2614bd2293592d455A4f',
    solana: '6riUFsScbBHa6T14SfLC19AXAHgE8A5JuZwn2g7QZN73',
    sui: '0x10649cdcee564178674f4fe719e5a8f48d6cc779684e022345ec16aacaf7b040',
};

const TOKENS = {
    usdc_base: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    usdc_solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    usdc_sui: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
    eth_base: '0x0000000000000000000000000000000000000000',
};

let wallet: ethers.Wallet | undefined;
if (process.env.EVM_PRIVATE_KEY) {
    wallet = new ethers.Wallet(
        process.env.EVM_PRIVATE_KEY as string,
        new ethers.JsonRpcProvider(process.env.BASE_RPC_URL as string || 'https://mainnet.base.org')
    );
}

const CHAIN_IDS = { base: 8453 };

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
        body: JSON.stringify({ quote, params }),
    });

    const result = await response.json();
    if (!result.success) throw new Error(`Build failed: ${result.error}`);
    return result;
}

async function executeTransaction(result: any): Promise<string | null> {
    if (!wallet || process.env.EXECUTE !== 'true') {
        return null;
    }

    const txData = result.transaction;
    if (txData.chainCategory !== 'evm' || !txData.transaction) {
        return null;
    }

    const tx = {
        to: txData.transaction.to,
        data: txData.transaction.data,
        value: txData.transaction.value,
        chainId: txData.transaction.chainId,
    };

    const txResponse = await wallet.sendTransaction(tx);
    console.log('📤 Tx sent:', txResponse.hash);

    const receipt = await txResponse.wait();
    console.log('✅ Confirmed in block:', receipt?.blockNumber);

    return txResponse.hash;
}

// Swift: Base -> Solana
async function testSwiftBaseToSolana() {
    console.log('\n=== Swift: Base -> Solana ===');

    const quote = await fetchQuote({
        fromToken: TOKENS.usdc_base,
        fromChain: 'base',
        toToken: TOKENS.usdc_solana,
        toChain: 'solana',
        amountIn: 3,
        swift: true,
    });

    const result = await buildTransaction(quote, {
        swapperAddress: ADDRESSES.evm,
        destinationAddress: ADDRESSES.solana,
        signerChainId: CHAIN_IDS.base,
    });

    console.log('✅ Built:', result.transaction.quoteType);
    console.log('To:', result.transaction.transaction.to);

    await executeTransaction(result);
    return result;
}

// MCTP: Base -> Sui
async function testMctpBaseToSui() {
    console.log('\n=== MCTP: Base -> Sui ===');

    const quote = await fetchQuote({
        fromToken: TOKENS.usdc_base,
        fromChain: 'base',
        toToken: TOKENS.usdc_sui,
        toChain: 'sui',
        amountIn: 3,
        mctp: true,
    });

    const result = await buildTransaction(quote, {
        swapperAddress: ADDRESSES.evm,
        destinationAddress: ADDRESSES.sui,
        signerChainId: CHAIN_IDS.base,
    });

    console.log('✅ Built:', result.transaction.quoteType);
    console.log('To:', result.transaction.transaction.to);

    await executeTransaction(result);
    return result;
}

// Fast MCTP: Base -> Solana
async function testFastMctpBaseToSolana() {
    console.log('\n=== Fast MCTP: Base -> Solana ===');

    const quote = await fetchQuote({
        fromToken: TOKENS.usdc_base,
        fromChain: 'base',
        toToken: TOKENS.usdc_solana,
        toChain: 'solana',
        amountIn: 3,
        fastMctp: true,
    });

    const result = await buildTransaction(quote, {
        swapperAddress: ADDRESSES.evm,
        destinationAddress: ADDRESSES.solana,
        signerChainId: CHAIN_IDS.base,
    });

    console.log('✅ Built:', result.transaction.quoteType);
    console.log('To:', result.transaction.transaction.to);

    await executeTransaction(result);
    return result;
}

// Monochain: Base (ETH -> USDC)
async function testMonochainBase() {
    console.log('\n=== Monochain: Base ===');

    const quote = await fetchQuote({
        fromToken: TOKENS.eth_base,
        fromChain: 'base',
        toToken: TOKENS.usdc_base,
        toChain: 'base',
        amountIn: 0.0003,
        monoChain: true,
    });

    const result = await buildTransaction(quote, {
        swapperAddress: ADDRESSES.evm,
        destinationAddress: ADDRESSES.evm,
        signerChainId: CHAIN_IDS.base,
    });

    console.log('✅ Built:', result.transaction.quoteType);
    console.log('To:', result.transaction.transaction.to);

    await executeTransaction(result);
    return result;
}

// Swift with Permit: Base -> Solana
async function testSwiftWithPermit() {
    console.log('\n=== Swift with Permit: Base -> Solana ===');

    const quote = await fetchQuote({
        fromToken: TOKENS.usdc_base,
        fromChain: 'base',
        toToken: TOKENS.usdc_solana,
        toChain: 'solana',
        amountIn: 3,
        swift: true,
    });

    // Create real permit signature
    // Requires EVM_PRIVATE_KEY env var
    const privateKey = process.env.EVM_PRIVATE_KEY;
    if (!privateKey) {
        console.log('⚠️ EVM_PRIVATE_KEY not set, skipping permit test');
        return null;
    }

    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const wallet = new ethers.Wallet(privateKey, provider);

    // USDC permit domain
    const domain = {
        name: 'USD Coin',
        version: '2',
        chainId: CHAIN_IDS.base,
        verifyingContract: TOKENS.usdc_base,
    };

    const types = {
        Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
        ],
    };

    // Get nonce from USDC contract
    const usdcAbi = ['function nonces(address owner) view returns (uint256)'];
    const usdcContract = new ethers.Contract(TOKENS.usdc_base, usdcAbi, provider);
    const nonce = await usdcContract.nonces(wallet.address);

    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const value = quote.effectiveAmountIn64;

    const permitValue = {
        owner: wallet.address,
        spender: quote.swiftMayanContract,
        value: value,
        nonce: nonce,
        deadline: deadline,
    };

    const signature = await wallet.signTypedData(domain, types, permitValue);
    const sig = ethers.Signature.from(signature);

    const permit = {
        value: value,
        deadline: deadline.toString(),
        v: sig.v,
        r: sig.r,
        s: sig.s,
    };

    const result = await buildTransaction(quote, {
        swapperAddress: wallet.address,
        destinationAddress: ADDRESSES.solana,
        signerChainId: CHAIN_IDS.base,
        permit,
    });

    console.log('✅ Built with permit:', result.transaction.quoteType);
    console.log('To:', result.transaction.transaction.to);

    await executeTransaction(result);
    return result;
}

async function main() {
    console.log('╔══════════════════════════════════════╗');
    console.log('║       EVM TRANSACTION TESTS          ║');
    console.log('╚══════════════════════════════════════╝');

    try {
        await testSwiftBaseToSolana(); // tx-hash: 0x3a75f69788a7217190ea07a12443a8904bc976eef8b7fc0d33bb43d714afb8ca
        await testMctpBaseToSui(); // tx-hash: 0x7480b9f6e6d47d76c26be65dd0d2e6d33ad47360fa1bee174216ebd85723f667
        await testFastMctpBaseToSolana(); // tx-hash: 0xb06f71524a721becf34f3259498b5ce58c64d7a6913e2f414d1ad83119e73f54
        await testMonochainBase(); // tx-hash: 0xbf8ebe9ca4be46389f8a7eb5406cb28bb3286596553ec392f1e0f48bd507b4ea
        await testSwiftWithPermit(); // tx-hash: 0xa91323420ebc4df5d177daeb82c345e27e3d3c1715944a21b0df4f96836b76f3

        console.log('\n✅ All EVM tests passed!');
    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

main();
