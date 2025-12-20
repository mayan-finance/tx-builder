const address = '0xEab4Fb2De5a05Ba392eB2614bd2293592d455A4f';

const signedQuote = `
{
    "maxUserGasDrop": 0.0011093756055117437,
    "sendTransactionCost": 0,
    "rentCost": "3000000",
    "gasless": false,
    "quoteId": "0x50c39faf07ae69dd2ec1ffb050153edd",
    "swiftVerifiedInputAddress": "",
    "swiftInputContractStandard": "erc20",
    "swiftVersion": "V1",
    "swiftMayanContract": "0xC38e4e6A15593f908255214653d3D947CA1c2338",
    "swiftAuctionMode": 2,
    "minMiddleAmount": 10,
    "swiftInputContract": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "swiftInputDecimals": 6,
    "slippageBps": 5,
    "effectiveAmountIn": 10,
    "effectiveAmountIn64": "10000000",
    "expectedAmountOut": 9.981444,
    "price": 0.9997457212770066,
    "priceImpact": null,
    "minAmountOut": 9.974999,
    "minReceived": 9.974999,
    "route": null,
    "swapRelayerFee": null,
    "swapRelayerFee64": null,
    "redeemRelayerFee": null,
    "redeemRelayerFee64": null,
    "solanaRelayerFee": null,
    "solanaRelayerFee64": null,
    "refundRelayerFee": null,
    "refundRelayerFee64": "1229",
    "cancelRelayerFee64": "3714",
    "submitRelayerFee64": "0",
    "deadline64": "1766243613",
    "clientRelayerFeeSuccess": null,
    "clientRelayerFeeRefund": 0.00494130688307124,
    "fromToken": {
        "name": "USDC",
        "standard": "erc20",
        "hasAuction": true,
        "symbol": "USDC",
        "mint": "EfqRM8ZGWhDTKJ7BHmFvNagKVu3AxQRDQs8WMMaoBCu6",
        "verified": true,
        "contract": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        "chainId": 8453,
        "wChainId": 30,
        "decimals": 6,
        "logoURI": "https://assets.coingecko.com/coins/images/6319/small/usdc.png?1696506694",
        "coingeckoId": "usd-coin",
        "pythUsdPriceId": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
        "realOriginContractAddress": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        "realOriginChainId": 30,
        "supportsPermit": true,
        "peggedAsset": "USD"
    },
    "fromChain": "base",
    "toToken": {
        "name": "USDC",
        "standard": "erc20",
        "hasAuction": true,
        "symbol": "USDC",
        "mint": "CR4xnGrhsu1fWNPoX4KbTUUtqGMF3mzRLfj4S6YEs1Yo",
        "verified": true,
        "contract": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        "chainId": 42161,
        "wChainId": 23,
        "decimals": 6,
        "logoURI": "https://assets.coingecko.com/coins/images/6319/small/usdc.png?1696506694",
        "coingeckoId": "usd-coin",
        "pythUsdPriceId": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
        "realOriginContractAddress": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        "realOriginChainId": 23,
        "supportsPermit": true,
        "peggedAsset": "USD"
    },
    "toTokenPrice": 0.99985366,
    "toChain": "arbitrum",
    "mintDecimals": null,
    "gasDrop": 0,
    "eta": 1,
    "etaSeconds": 10,
    "clientEta": "10s",
    "bridgeFee": 0,
    "suggestedPriorityFee": 0,
    "type": "SWIFT",
    "priceStat": {
        "ratio": 0.9997461285625,
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
    "expectedAmountOutBaseUnits": "9981444",
    "minAmountOutBaseUnits": "9974999",
    "minReceivedBaseUnits": "9974999",
    "signature": "0xf6cefe5b8cd26514507ca0004743893931a88d703cae82b6465d61e900bfb8af2c139aa91d32beb8b0f7d94dcf52a8248393b675d47d3934ae7b9a5f98a1e3441c"
}`;

console.log("Sending request to build transaction");
const response = await fetch('http://localhost:3000/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        quotes: JSON.parse(signedQuote),  // Parse the JSON string to object
        params: {
            swapperAddress: address,
            destinationAddress: address,
            signerChainId: 8453,
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
    
    if (txData.chainCategory === 'evm' && txData.transaction) {
        console.log("\n=== Signing and Sending Transaction ===");
        
        // Import ethers
        const { ethers } = await import('ethers');
        
        // Create provider and wallet
        const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
        const wallet = new ethers.Wallet(process.env.EVM_PRIVATE_KEY || '', provider);
        console.log("Wallet connected:", wallet.address);
        
        // Prepare transaction
        const tx = {
            to: txData.transaction.to,
            data: txData.transaction.data,
            value: txData.transaction.value,
            chainId: txData.transaction.chainId,
        };
        console.log("Transaction prepared");
        
        // Send transaction
        const txResponse = await wallet.sendTransaction(tx);
        console.log("Transaction sent! Hash:", txResponse.hash);
        
        // Wait for confirmation
        const receipt = await txResponse.wait();
        console.log("Transaction confirmed in block:", receipt?.blockNumber);
        console.log("Status:", receipt?.status === 1 ? "Success" : "Failed");
    }
}
// tx-hash: 0x9d954afc168e08363257fc45560642cd7eae869119d765355aa39c5d613b36ac