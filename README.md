# Mayan Transaction Builder API

A transaction builder API that returns unsigned transactions for Mayan Finance cross-chain swaps. Supports EVM chains, Solana/Fogo (SVM), and SUI.

## Features

- **Quote Signature Verification**: Validates quote signatures before building transactions
- **Multi-chain Support**: EVM, SVM (Solana, Fogo), and SUI
- **Multiple Quote Types**: WH, SWIFT, MCTP, FAST_MCTP, MONO_CHAIN, SHUTTLE
- **Optional Permit Support**: ERC20 permits for gasless approvals on EVM
- **Batch Processing**: Build multiple transactions in one request

## Quick Start

### Installation

```bash
bun install
```

### Configuration

Set environment variables:

```bash
export PORT=3000
export EXPECTED_SIGNER_ADDRESS="0x..."  # Required: Address that signs quotes
export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
export FOGO_RPC_URL="https://rpc.fogo.network"
export SUI_RPC_URL="https://fullnode.mainnet.sui.io"
```

### Run

```bash
# Development with hot reload
bun run dev

# Production
bun run start
```

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Build Transaction

```
POST /build
```

#### Request Body

```json
{
  "quotes": {
    "type": "MCTP",
    "fromChain": "ethereum",
    "toChain": "solana",
    "signature": "0x...",
    // ... other quote fields from Mayan API
  },
  "params": {
    "swapperAddress": "0x...",
    "destinationAddress": "...",
    "signerChainId": 1,
    "referrerAddresses": {
      "evm": "0x...",
      "solana": "...",
      "sui": "..."
    },
    "permit": {
      "value": "1000000000000000000",
      "deadline": 1735689600,
      "v": 27,
      "r": "0x...",
      "s": "0x..."
    },
    "customPayload": "0x...",
    "usdcPermitSignature": "0x..."
  }
}
```

#### Parameters by Chain Type

**EVM (Required)**
- `swapperAddress`: User's EVM wallet address
- `signerChainId`: Chain ID of the source chain

**SVM (Required)**
- `swapperAddress`: User's Solana/Fogo wallet address

**SUI (Required)**
- `swapperAddress`: User's SUI wallet address

**Optional (All chains)**
- `destinationAddress`: Recipient address on destination chain
- `referrerAddresses`: Referrer addresses for fee sharing
- `customPayload`: Hex-encoded custom payload
- `permit`: ERC20 permit for gasless approval (EVM only)
- `usdcPermitSignature`: USDC permit signature for HyperCore deposits

#### Response - EVM

```json
{
  "success": true,
  "transactions": [
    {
      "chainCategory": "evm",
      "quoteType": "MCTP",
      "transaction": {
        "to": "0x...",
        "data": "0x...",
        "value": "0",
        "chainId": 1
      },
      "forwarderParams": {
        "method": "forwardERC20",
        "params": [...]
      }
    }
  ]
}
```

#### Response - SVM (Solana/Fogo)

```json
{
  "success": true,
  "transactions": [
    {
      "chainCategory": "svm",
      "quoteType": "SWIFT",
      "instructions": [
        {
          "programId": "...",
          "keys": [
            {"pubkey": "...", "isSigner": true, "isWritable": true}
          ],
          "data": "base64..."
        }
      ],
      "signers": ["base58-encoded-secret-keys"],
      "lookupTables": ["base58-encoded-addresses"]
    }
  ]
}
```

#### Response - SUI

```json
{
  "success": true,
  "transactions": [
    {
      "chainCategory": "sui",
      "quoteType": "MCTP",
      "transaction": "base64-encoded-transaction-bytes"
    }
  ]
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Invalid signature for quote(s) at index: 0",
  "code": "INVALID_SIGNATURE"
}
```

Error codes:
- `INVALID_REQUEST`: Missing or malformed request data
- `INVALID_SIGNATURE`: Quote signature verification failed
- `BUILD_FAILED`: Transaction building failed
- `INTERNAL_ERROR`: Unexpected server error

## Usage Examples

### EVM Transaction (TypeScript)

```typescript
const response = await fetch('http://localhost:3000/build', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quotes: signedQuote,
    params: {
      swapperAddress: '0xYourAddress',
      destinationAddress: 'YourSolanaAddress',
      signerChainId: 1,
    }
  })
});

const { transactions } = await response.json();
const tx = transactions[0];

// Send with ethers.js
const signer = await provider.getSigner();
await signer.sendTransaction({
  to: tx.transaction.to,
  data: tx.transaction.data,
  value: tx.transaction.value,
});
```

### Solana Transaction (TypeScript)

```typescript
import { Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const response = await fetch('http://localhost:3000/build', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quotes: signedQuote,
    params: {
      swapperAddress: wallet.publicKey.toBase58(),
      destinationAddress: 'YourEvmAddress',
    }
  })
});

const { transactions } = await response.json();
const tx = transactions[0];

// Reconstruct instructions
const instructions = tx.instructions.map(ix => new TransactionInstruction({
  programId: new PublicKey(ix.programId),
  keys: ix.keys.map(k => ({
    pubkey: new PublicKey(k.pubkey),
    isSigner: k.isSigner,
    isWritable: k.isWritable,
  })),
  data: Buffer.from(ix.data, 'base64'),
}));

// Build and sign transaction
const transaction = new Transaction().add(...instructions);
const signed = await wallet.signTransaction(transaction);
await connection.sendRawTransaction(signed.serialize());
```

### SUI Transaction (TypeScript)

```typescript
import { Transaction } from '@mysten/sui/transactions';

const response = await fetch('http://localhost:3000/build', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quotes: signedQuote,
    params: {
      swapperAddress: wallet.address,
      destinationAddress: 'YourEvmAddress',
    }
  })
});

const { transactions } = await response.json();
const tx = transactions[0];

// Deserialize and sign
const txBytes = Buffer.from(tx.transaction, 'base64');
await suiClient.signAndExecuteTransaction({
  signer: wallet,
  transaction: Transaction.from(txBytes),
});
```

## Gasless Transactions (SWIFT)

When a quote has `gasless: true`, the response includes `gaslessParams` instead of transaction data. The user must sign typed data and submit via Mayan's relayer:

```typescript
import { submitSwiftEvmSwap } from '@mayanfinance/swap-sdk';

const { transactions } = await response.json();
const tx = transactions[0];

if (tx.gaslessParams) {
  // Sign the typed data
  const signature = await signer.signTypedData(
    tx.gaslessParams.orderTypedData.domain,
    tx.gaslessParams.orderTypedData.types,
    tx.gaslessParams.orderTypedData.value
  );

  // Submit via Mayan relayer
  await submitSwiftEvmSwap(tx.gaslessParams, signature);
}
```

## Development

```bash
# Type checking
bun run typecheck

# Build for production
bun run build
```

## License

MIT
