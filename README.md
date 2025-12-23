# Mayan TX Builder

A transaction builder API for [Mayan Finance](https://mayan.finance) cross-chain swaps. Returns unsigned transactions for EVM, Solana, and Sui chains.

## Features

- Build unsigned transactions from signed quotes
- Support for EVM chains (Ethereum, Base, Arbitrum, Polygon, etc.)
- Support for SVM chains (Solana, Fogo)
- Support for Sui chain
- Quote signature verification
- Gasless transaction support for SWIFT quotes on EVM

## Prerequisites

- [Bun](https://bun.sh) v1.0 or later
- RPC endpoints for the chains you want to support

## Installation

```bash
bun install
```

## Configuration

The server is configured via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `EXPECTED_SIGNER_ADDRESS` | Address that signed the quotes (for verification) | `0xf39Fd6...` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `FOGO_RPC_URL` | Fogo RPC endpoint | `https://rpc.fogo.network` |
| `SUI_RPC_URL` | Sui RPC endpoint | `https://fullnode.mainnet.sui.io` |

## Running Locally

### Development mode (with hot reload)

```bash
bun run dev
```

### Production mode

```bash
bun run start
```

## Running with Docker

### Build the image

```bash
docker build -t mayan-tx-builder .
```

### Run the container

```bash
docker run -d \
  -p 3000:3000 \
  -e EXPECTED_SIGNER_ADDRESS=0x... \
  -e SOLANA_RPC_URL=https://your-solana-rpc.com \
  -e SUI_RPC_URL=https://your-sui-rpc.com \
  --name mayan-tx-builder \
  mayan-tx-builder
```

### Using Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  tx-builder:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - EXPECTED_SIGNER_ADDRESS=0x...
      - SOLANA_RPC_URL=https://your-solana-rpc.com
      - FOGO_RPC_URL=https://rpc.fogo.network
      - SUI_RPC_URL=https://your-sui-rpc.com
    restart: unless-stopped
```

Then run:

```bash
docker compose up -d
```

## API Endpoints

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Build Transaction

```
POST /build
```

**Request Body:**

```json
{
  "quotes": {
    "type": "SWIFT",
    "fromChain": "base",
    "toChain": "arbitrum",
    "signature": "0x...",
    ...
  },
  "params": {
    "swapperAddress": "0x...",
    "destinationAddress": "0x...",
    "signerChainId": 8453
  }
}
```

**Response (EVM non-gasless):**
```json
{
  "success": true,
  "transactions": [
    {
      "chainCategory": "evm",
      "quoteType": "SWIFT",
      "gasless": false,
      "transaction": {
        "to": "0x...",
        "data": "0x...",
        "value": "0",
        "chainId": 8453
      }
    }
  ]
}
```

**Response (Solana):**
```json
{
  "success": true,
  "transactions": [
    {
      "chainCategory": "svm",
      "quoteType": "SWIFT",
      "transaction": "base64-encoded-transaction"
    }
  ]
}
```

**Response (Sui):**
```json
{
  "success": true,
  "transactions": [
    {
      "chainCategory": "sui",
      "quoteType": "MCTP",
      "transaction": "base64-encoded-transaction"
    }
  ]
}
```

## Examples

See the `examples/` directory for complete examples:

- `examples/evm.ts` - EVM chain example (Base → Arbitrum)
- `examples/solana.ts` - Solana chain example
- `examples/sui.ts` - Sui chain example

Run an example:

```bash
# Start the server first
bun run start

# In another terminal, run an example
bun run examples/evm.ts
```

## Chain-specific Parameters

### EVM Chains

Required params:
- `swapperAddress` - The sender's address
- `destinationAddress` - The recipient's address
- `signerChainId` - The chain ID where the transaction will be signed

Optional:
- `permit` - ERC20 permit data for gasless approvals
- `usdcPermitSignature` - USDC permit signature

### Solana (SVM) Chains

Required params:
- `swapperAddress` - The sender's public key (base58)
- `destinationAddress` - The recipient's address

### Sui Chain

Required params:
- `swapperAddress` - The sender's Sui address (0x...)
- `destinationAddress` - The recipient's address

## Error Responses

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Error codes:
- `INVALID_REQUEST` - Missing or invalid request parameters
- `INVALID_SIGNATURE` - Quote signature verification failed
- `BUILD_FAILED` - Transaction building failed
- `INTERNAL_ERROR` - Unexpected server error

## License

MIT

