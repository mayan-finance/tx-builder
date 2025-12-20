import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

const srcAddress = '6riUFsScbBHa6T14SfLC19AXAHgE8A5JuZwn2g7QZN73';
const destAddress = '0xEab4Fb2De5a05Ba392eB2614bd2293592d455A4f';

const signedQuote = `{
    "maxUserGasDrop": 0.0011414543075743088,
    "sendTransactionCost": 0,
    "rentCost": "3000000",
    "gasless": false,
    "quoteId": "0x0c7744e8ed48d8c1f415c0db47a8e2aa",
    "swiftVerifiedInputAddress": "",
    "swiftInputContractStandard": "spl",
    "swiftVersion": "V1",
    "swiftMayanContract": "BLZRi6frs4X4DNLw56V4EXai1b6QVESN1BhHBTYM9VcY",
    "swiftAuctionMode": 2,
    "minMiddleAmount": 3.0914520000000003,
    "swiftInputContract": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "swiftInputDecimals": 6,
    "slippageBps": 225,
    "effectiveAmountIn": 3.1,
    "effectiveAmountIn64": "3100000",
    "expectedAmountOut": 4.09081164174901,
    "price": 1.3913294543091592,
    "priceImpact": null,
    "minAmountOut": 3.99897292039174,
    "minReceived": 3.99897292039174,
    "route": null,
    "swapRelayerFee": null,
    "swapRelayerFee64": null,
    "redeemRelayerFee": null,
    "redeemRelayerFee64": null,
    "solanaRelayerFee": null,
    "solanaRelayerFee64": null,
    "refundRelayerFee": null,
    "refundRelayerFee64": "553972",
    "cancelRelayerFee64": "5265",
    "submitRelayerFee64": "0",
    "deadline64": "1766248985",
    "clientRelayerFeeSuccess": null,
    "clientRelayerFeeRefund": 0.5591572922601565,
    "fromToken": {
        "name": "Tether",
        "standard": "spl",
        "symbol": "USDT",
        "mint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        "verified": true,
        "contract": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        "chainId": 0,
        "wChainId": 1,
        "decimals": 6,
        "logoURI": "https://assets.coingecko.com/coins/images/325/small/Tether-logo.png?1598003707",
        "coingeckoId": "tether",
        "pythUsdPriceId": "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
        "realOriginContractAddress": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        "realOriginChainId": 1,
        "supportsPermit": false,
        "hasAuction": true
    },
    "fromChain": "solana",
    "toToken": {
        "name": "Aster",
        "symbol": "ASTER",
        "mint": "",
        "verified": true,
        "contract": "0x000Ae314E2A2172a039B26378814C252734f556A",
        "chainId": 56,
        "wChainId": 4,
        "decimals": 18,
        "logoURI": "https://coin-images.coingecko.com/coins/images/69040/small/_ASTER.png?1757326782",
        "coingeckoId": "aster-2",
        "realOriginChainId": 4,
        "realOriginContractAddress": "0x000Ae314E2A2172a039B26378814C252734f556A",
        "supportsPermit": false,
        "standard": "erc20",
        "hasAuction": true
    },
    "toTokenPrice": 0.718087,
    "toChain": "bsc",
    "mintDecimals": null,
    "gasDrop": 0,
    "eta": 1,
    "etaSeconds": 10,
    "clientEta": "10s",
    "bridgeFee": 0,
    "suggestedPriorityFee": 30000,
    "type": "SWIFT",
    "priceStat": {
        "ratio": 0.9995195937247862,
        "status": "GOOD"
    },
    "referrerBps": 0,
    "protocolBps": 3,
    "onlyBridging": false,
    "sourceSwapExpense": 0,
    "relayer": null,
    "meta": {
        "advertisedDescription": "Cheapest and Fastest",
        "advertisedTitle": "Best",
        "icon": "https://cdn.mayan.finance/fast_icon.png",
        "switchText": "Switch to the best route",
        "title": "Best"
    },
    "expectedAmountOutBaseUnits": "4090811641749010000",
    "minAmountOutBaseUnits": "3998972920391740000",
    "minReceivedBaseUnits": "3998972920391740000",
    "signature": "0x8c07e235684a5b6db49fc0c1462b451fe42ec7ce8b7fe5c69f078db75209914c4d4128977964ab230d37e7e88fd851ff39b2086c6f9c215eb4894d67683ccf111b"
}`;

console.log("Sending request to build transaction");
const response = await fetch('http://localhost:3000/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        quotes: JSON.parse(signedQuote),  // Parse the JSON string to object
        params: {
            swapperAddress: srcAddress,
            destinationAddress: destAddress,
        }
    })
});
console.log("Response received");
const result = await response.json();
console.log("Status:", response.status);
console.log("Result:", JSON.stringify(result, null, 2));

// Sign and send the transaction
if (result.success && result.transactions.length > 0) {
    const txData = result.transactions[0];
    
    if (txData.chainCategory === 'svm' && txData.transaction) {
        console.log("\n=== Signing and Sending Transaction ===");
        
        const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
        
        const transactionBuffer = Buffer.from(txData.transaction, 'base64');
        const transaction = VersionedTransaction.deserialize(transactionBuffer);
        console.log("Transaction deserialized successfully");
        
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.message.recentBlockhash = blockhash;
        console.log("Recent blockhash set:", blockhash);
        
        const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.SOLANA_PRIVATE_KEY || '')));
        transaction.sign([keypair]);
        console.log("Transaction signed");
        
        const signature = await connection.sendTransaction(transaction);
        console.log("Transaction sent! Signature:", signature);
        
        const confirmation = await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
        });
        console.log("Transaction confirmed:", confirmation);
    }
}