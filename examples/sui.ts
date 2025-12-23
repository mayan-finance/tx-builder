import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

const srcAddress = '0x10649cdcee564178674f4fe719e5a8f48d6cc779684e022345ec16aacaf7b040';
const destAddress = '0xEab4Fb2De5a05Ba392eB2614bd2293592d455A4f';

const signedQuote = `{
    "withHub": false,
    "hubRelayerFee64": "0",
    "circleMaxFee64": "0",
    "fastMctpMinFinality": 1,
    "maxUserGasDrop": 0.0005625647447620204,
    "sendTransactionCost": 0,
    "rentCost": "1774800",
    "gasless": false,
    "slippageBps": 0,
    "effectiveAmountIn": 5,
    "effectiveAmountIn64": "5000000",
    "expectedAmountOut": 4.996423,
    "price": 0.9994403835231951,
    "priceImpact": null,
    "minAmountOut": 4.996422,
    "minReceived": 4.996422,
    "route": null,
    "swapRelayerFee": 0,
    "swapRelayerFee64": "0",
    "solanaRelayerFee": 0,
    "solanaRelayerFee64": "0",
    "redeemRelayerFee": 0.003577,
    "redeemRelayerFee64": "3577",
    "refundRelayerFee": 0.003577,
    "refundRelayerFee64": "3577",
    "clientRelayerFeeSuccess": 0.003577196135,
    "clientRelayerFeeRefund": 0.003577196135,
    "cancelRelayerFee64": null,
    "submitRelayerFee64": null,
    "deadline64": "1766520269",
    "fromToken": {
        "name": "USDC",
        "standard": "suicoin",
        "symbol": "USDC",
        "mint": "",
        "verified": true,
        "contract": "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
        "chainId": 1999,
        "wChainId": 21,
        "decimals": 6,
        "logoURI": "https://assets.coingecko.com/coins/images/6319/small/usdc.png?1696506694",
        "coingeckoId": "usd-coin",
        "pythUsdPriceId": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
        "realOriginContractAddress": "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
        "realOriginChainId": 21,
        "verifiedAddress": "0x69b7a7c3c200439c1b5f3b19d7d495d5966d5f08de66c69276152f8db3992ec6",
        "peggedAsset": "USD"
    },
    "fromChain": "sui",
    "toToken": {
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
    "toChain": "base",
    "mintDecimals": null,
    "gasDrop": 0,
    "eta": 1,
    "etaSeconds": 60,
    "clientEta": "1 min",
    "bridgeFee": 0,
    "suggestedPriorityFee": 0,
    "type": "MCTP",
    "priceStat": {
        "ratio": 1,
        "status": "GOOD"
    },
    "referrerBps": 0,
    "meta": {
        "advertisedDescription": "Cheapest and Fastest",
        "advertisedTitle": "Best",
        "icon": "https://cdn.mayan.finance/fast_icon.png",
        "switchText": "Switch to the best route",
        "title": "Best"
    },
    "cheaperChain": "base",
    "lockFeesOnSource": false,
    "hasAuction": false,
    "onlyBridging": true,
    "mctpInputContract": "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    "mctpVerifiedInputAddress": "0x69b7a7c3c200439c1b5f3b19d7d495d5966d5f08de66c69276152f8db3992ec6",
    "mctpInputTreasury": "0x57d6725e7a8b49a7b2a612f6bd66ab5f39fc95332ca48be421c3229d514a6de7",
    "mctpOutputContract": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "toPrice": 0.9998440900000001,
    "minMiddleAmount": 5,
    "sourceSwapExpense": 0,
    "expectedAmountOutBaseUnits": "4996423",
    "minAmountOutBaseUnits": "4996422",
    "minReceivedBaseUnits": "4996422",
    "signature": "0x3334714ed048152884893063cd630afb8e7c1631ef5e873ab0e21ecaf563bee276a76d6da9535962e2c4b728690c0f991245c7d3b2d1c48d784064a645d6cf991b"
}`;

console.log("Sending request to build transaction");
const response = await fetch('http://localhost:3000/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        quotes: JSON.parse(signedQuote),
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
    
    if (txData.chainCategory === 'sui' && txData.transaction) {
        console.log("\n=== Signing and Sending Transaction ===");
        
        const suiClient = new SuiClient({ 
            url: process.env.SUI_RPC_URL || 'https://fullnode.mainnet.sui.io:443' 
        });
        
        // Deserialize the transaction from base64
        const transactionBytes = Buffer.from(txData.transaction, 'base64');
        const transaction = Transaction.from(transactionBytes);
        console.log("Transaction deserialized successfully");
        
        const privateKey = process.env.SUI_PRIVATE_KEY || '';
        const { secretKey } = decodeSuiPrivateKey(privateKey);
        const keypair = Ed25519Keypair.fromSecretKey(secretKey);
        console.log("Keypair loaded, address:", keypair.getPublicKey().toSuiAddress());
        
        // Sign and execute the transaction
        const txResponse = await suiClient.signAndExecuteTransaction({
            signer: keypair,
            transaction,
            options: {
                showEffects: true,
                showEvents: true,
            }
        });
        console.log("Transaction sent! Digest:", txResponse.digest);
        
        // Wait for confirmation
        const confirmation = await suiClient.waitForTransaction({
            digest: txResponse.digest,
            options: { showEffects: true }
        });
        console.log("Transaction confirmed!");
        console.log("Status:", confirmation.effects?.status?.status);
    }
}
// tx-hash: 3waTdddEBqaoaSuvFiHCKe2yymrgw4AcqzfxuB9iKEym