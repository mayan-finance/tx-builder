# Mayan Transaction Builder API

A RESTful API service that generates unsigned transactions for cross-chain swaps powered by [Mayan Finance](https://mayan.finance). This service wraps the [@mayanfinance/swap-sdk](https://www.npmjs.com/package/@mayanfinance/swap-sdk) to provide a simple HTTP interface for fetching quotes and building transactions across Solana, Sui, and EVM chains.

## Disclaimer

> **Security Recommendation**: The Mayan team strongly recommends using the [@mayanfinance/swap-sdk](https://www.npmjs.com/package/@mayanfinance/swap-sdk) directly in your application for enhanced security and control. If you choose to use this service, we recommend running it yourself rather than relying on third-party hosted instances.
>
> **Using the Mayan-hosted endpoint (`https://tx-builder.mayan.finance`) is at your own risk.** While we maintain this endpoint for convenience, self-hosting provides better security guarantees for production applications handling user funds.

## Features

- **Multi-chain Support**: Build transactions for Solana, Sui, and 10+ EVM chains
- **Multiple Bridge Protocols**: SWIFT, MCTP, Fast MCTP, Wormhole, and more
- **Quote Fetching**: Get competitive quotes with automatic route optimization
- **Permit Support**: EIP-2612 permit signatures for gasless token approvals
- **Monochain Swaps**: Single-chain token swaps with DEX aggregation
- **Quote Signature Verification**: Cryptographic verification of all quotes
- **API Key Authentication**: Optional API key requirement with rate limiting
- **Prometheus Metrics**: Built-in metrics endpoint for monitoring

## Supported Chains

| Chain Category | Networks |
|---------------|----------|
| **EVM** | Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, BSC, Linea, Unichain, Sonic, HyperEVM, Monad |
| **SVM** | Solana, Fogo |
| **Sui** | Sui |

## Prerequisites

- [Bun](https://bun.sh) v1.0 or later
- RPC endpoints for the chains you want to support

## Installation

```bash
# Clone the repository
git clone https://github.com/mayan-finance/tx-builder.git
cd tx-builder

# Install dependencies
bun install
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `EXPECTED_SIGNER_ADDRESS` | Quote signature verification address | Mayan signer |
| `SOLANA_RPC_URL` | Solana RPC endpoint | Public RPC |
| `SUI_RPC_URL` | Sui RPC endpoint | Public RPC |
| `FOGO_RPC_URL` | Fogo RPC endpoint | Public RPC |
| `ETHEREUM_RPC_URL` | Ethereum RPC endpoint | Public RPC |
| `BASE_RPC_URL` | Base RPC endpoint | Public RPC |
| `ARBITRUM_RPC_URL` | Arbitrum RPC endpoint | Public RPC |
| `POLYGON_RPC_URL` | Polygon RPC endpoint | Public RPC |
| `AVALANCHE_RPC_URL` | Avalanche RPC endpoint | Public RPC |
| `BSC_RPC_URL` | BSC RPC endpoint | Public RPC |
| `OPTIMISM_RPC_URL` | Optimism RPC endpoint | Public RPC |
| `ENABLE_API_KEY` | Enable API key authentication | `false` |
| `API_KEYS` | Comma-separated list of valid API keys | - |
| `RATE_LIMIT_WINDOW_MS` | Rate limit time window in ms | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window per API key | `100` |

## Running the Server

### Development mode (with hot reload)

```bash
bun run dev
```

### Production mode

```bash
bun run start
```

### Type checking

```bash
bun run typecheck
```

The server will start at `http://localhost:3000` by default.

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

## API Key Authentication

The service supports optional API key authentication with per-key rate limiting. By default, authentication is disabled.

### Enabling API Key Authentication

1. Set `ENABLE_API_KEY=true` in your environment
2. Configure valid API keys as a comma-separated list in `API_KEYS`
3. Optionally configure rate limits with `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`

### Using API Keys

When authentication is enabled, include the `X-API-Key` header in your requests:

```bash
curl -X POST http://localhost:3000/build \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{ ... }'
```

### Rate Limiting

- Rate limiting applies to `/build`, `/permit-params`, and `/hypercore/permit-params` endpoints
- The `/quote` endpoint is exempt from rate limiting (but still tracked in metrics)
- `/health` and `/metrics` endpoints bypass authentication entirely
- Default: 100 requests per minute per API key

### Error Responses

**Missing API Key (when authentication is enabled):**
```json
{
  "success": false,
  "error": "API key required. Please provide X-API-Key header.",
  "code": "UNAUTHORIZED"
}
```

**Invalid API Key:**
```json
{
  "success": false,
  "error": "Invalid API key",
  "code": "UNAUTHORIZED"
}
```

**Rate Limit Exceeded:**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMITED"
}
```

## API Endpoints

### Health Check

```
GET /health
```

Returns server status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

---

### Get Forwarder Address

```
GET /forwarder-address
```

Returns the Mayan Forwarder contract address. Users must approve this address to spend their ERC20 tokens before executing swaps.

**Response:**
```json
{
  "success": true,
  "forwarderAddress": "0x337685fdaB40D39bd02028545a4FfA7D287cC3E2",
  "description": "Mayan Forwarder contract address. Approve this address to spend your ERC20 tokens before swapping."
}
```

**Usage:** Before executing an EVM swap with ERC20 tokens, you must either:
1. **Pre-approve** the forwarder address using the standard ERC20 `approve()` function
2. **Use permit signature** via the `/permit-params` endpoint (for tokens that support EIP-2612)

See [ERC20 Token Approval](#erc20-token-approval) section for detailed examples.

---

### Prometheus Metrics

```
GET /metrics
```

Returns Prometheus-formatted metrics for monitoring. This endpoint is always accessible without authentication.

**Available Metrics:**
- `api_requests_total` - Total API requests by API key, endpoint, method, and status
- `api_request_duration_seconds` - Request duration histogram
- `rate_limit_exceeded_total` - Rate limit exceeded events by API key and endpoint
- Default Node.js metrics (CPU, memory, event loop, etc.)

**Example Prometheus scrape config:**
```yaml
scrape_configs:
  - job_name: 'mayan-tx-builder'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

---

### Fetch Quote

```
POST /quote
```

Fetches swap quotes from Mayan's routing engine.

**Request Body:**
```json
{
  "fromToken": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "fromChain": "base",
  "toToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "toChain": "solana",
  "amountIn64": "3000000",
  "slippageBps": "auto",
  "swift": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fromToken` | string | Yes | Source token address |
| `fromChain` | string | Yes | Source chain name |
| `toToken` | string | Yes | Destination token address |
| `toChain` | string | Yes | Destination chain name |
| `amountIn64` | string | Yes* | Amount in smallest unit (recommended) |
| `amount` | number | Yes* | Amount in token decimals |
| `slippageBps` | string \| number | Yes | `"auto"` or basis points (50 = 0.5%) |
| `swift` | boolean | No | Enable SWIFT protocol |
| `mctp` | boolean | No | Enable MCTP protocol |
| `fastMctp` | boolean | No | Enable Fast MCTP protocol |
| `wormhole` | boolean | No | Enable Wormhole protocol |
| `monoChain` | boolean | No | Single-chain swap mode |
| `gasless` | boolean | No | Enable gasless transactions |
| `gasDrop` | number | No | Native token to receive on destination |
| `referrer` | string | No | Referrer address |
| `referrerBps` | number | No | Referrer fee in basis points |

*Either `amountIn64` or `amount` is required. `amountIn64` is recommended for precision.

**Response:**
```json
{
  "success": true,
  "quotes": [
    {
      "type": "SWIFT",
      "fromToken": { ... },
      "toToken": { ... },
      "expectedAmountOut": "2985000",
      "minAmountOut": "2970075",
      "signature": "0x...",
      ...
    }
  ]
}
```

---

### Build Transaction

```
POST /build
```

Builds an unsigned transaction from a signed quote.

**Request Body:**
```json
{
  "quote": { /* Quote object from /quote response */ },
  "params": {
    "swapperAddress": "0xYourWalletAddress",
    "destinationAddress": "RecipientAddress",
    "signerChainId": 8453
  }
}
```

**Parameters by Chain:**

| Chain | Required Params |
|-------|-----------------|
| **EVM** | `swapperAddress`, `destinationAddress`, `signerChainId`, `permit` (optional) |
| **Solana** | `swapperAddress`, `destinationAddress` |
| **Sui** | `swapperAddress`, `destinationAddress` |

**EVM Response:**
```json
{
  "success": true,
  "transaction": {
    "chainCategory": "evm",
    "quoteType": "SWIFT",
    "gasless": false,
    "transaction": {
      "to": "0x337685fdaB40D39bd02028545a4FfA7D287cC3E2",
      "data": "0x...",
      "value": "0",
      "chainId": 8453
    }
  }
}
```

**Solana Response:**
```json
{
  "success": true,
  "transaction": {
    "chainCategory": "svm",
    "quoteType": "SWIFT",
    "transaction": "AgABCN+DnsP6ICr2...",
    "signers": ["base58EncodedKeypair..."]
  }
}
```

**Sui Response:**
```json
{
  "success": true,
  "transaction": {
    "chainCategory": "sui",
    "quoteType": "MCTP",
    "transaction": "AAACAQACAg..."
  }
}
```

---

### Get Permit Parameters (ERC20)

```
POST /permit-params
```

Gets EIP-2612 permit parameters for gasless token approvals.

**Request Body:**
```json
{
  "quote": { /* Quote object */ },
  "walletAddress": "0xYourWalletAddress",
  "deadline": "1705320000"
}
```

**Response:**
```json
{
  "success": true,
  "permitParams": {
    "domain": {
      "name": "USD Coin",
      "version": "2",
      "chainId": 8453,
      "verifyingContract": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
    },
    "types": {
      "Permit": [
        { "name": "owner", "type": "address" },
        { "name": "spender", "type": "address" },
        { "name": "value", "type": "uint256" },
        { "name": "nonce", "type": "uint256" },
        { "name": "deadline", "type": "uint256" }
      ]
    },
    "value": {
      "owner": "0x...",
      "spender": "0x...",
      "value": "3000000",
      "nonce": 0,
      "deadline": "1705320000"
    }
  }
}
```

---

### Get HyperCore Permit Parameters

```
POST /hypercore/permit-params
```

Gets permit parameters for HyperCore USDC deposits on Arbitrum.

**Request Body:**
```json
{
  "quote": { /* Quote object */ },
  "userArbitrumAddress": "0xYourArbitrumAddress"
}
```

## Usage Examples

### JavaScript/TypeScript

```typescript
// 1. Fetch a quote
const quoteResponse = await fetch('http://localhost:3000/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fromToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    fromChain: 'base',
    toToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    toChain: 'solana',
    amountIn64: '3000000',
    slippageBps: 'auto',
    swift: true,
  }),
});

const { quotes } = await quoteResponse.json();
const quote = quotes[0];

// 2. Build the transaction
const buildResponse = await fetch('http://localhost:3000/build', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quote,
    params: {
      swapperAddress: '0xYourWalletAddress',
      destinationAddress: 'YourSolanaAddress',
      signerChainId: 8453,
    },
  }),
});

const { transaction } = await buildResponse.json();

// 3. Sign and send the transaction using your wallet
// For EVM:
const tx = {
  to: transaction.transaction.to,
  data: transaction.transaction.data,
  value: transaction.transaction.value,
  chainId: transaction.transaction.chainId,
};
const txResponse = await wallet.sendTransaction(tx);
```

### With ERC20 Permit (Gasless Approval)

```typescript
// 1. Fetch quote (same as above)
// ...

// 2. Get permit parameters
const permitResponse = await fetch('http://localhost:3000/permit-params', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quote,
    walletAddress: '0xYourWalletAddress',
  }),
});

const { permitParams } = await permitResponse.json();

// 3. Sign the permit
const signature = await wallet.signTypedData(
  permitParams.domain,
  permitParams.types,
  permitParams.value
);

const sig = ethers.Signature.from(signature);
const permit = {
  value: permitParams.value.value,
  deadline: permitParams.value.deadline,
  v: sig.v,
  r: sig.r,
  s: sig.s,
};

// 4. Build transaction with permit
const buildResponse = await fetch('http://localhost:3000/build', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quote,
    params: {
      swapperAddress: '0xYourWalletAddress',
      destinationAddress: 'YourSolanaAddress',
      signerChainId: 8453,
      permit,
    },
  }),
});
```

### Solana Transaction

```typescript
import { Connection, VersionedTransaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// After building the transaction...
const txBuffer = Buffer.from(transaction.transaction, 'base64');
const tx = VersionedTransaction.deserialize(txBuffer);

// Sign with additional signers if provided
if (transaction.signers?.length > 0) {
  const additionalSigners = transaction.signers.map(s =>
    Keypair.fromSecretKey(bs58.decode(s))
  );
  tx.sign(additionalSigners);
}

// Sign with user's keypair
tx.sign([userKeypair]);

// Send transaction
const connection = new Connection('https://api.mainnet-beta.solana.com');
const signature = await connection.sendTransaction(tx);
```

### Sui Transaction

```typescript
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

// After building the transaction...
const txBytes = Uint8Array.from(Buffer.from(transaction.transaction, 'base64'));
const tx = Transaction.from(txBytes);

const suiClient = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });
const result = await suiClient.signAndExecuteTransaction({
  signer: keypair,
  transaction: tx,
});
```

## ERC20 Token Approval

Before swapping ERC20 tokens on EVM chains, you must authorize the Mayan Forwarder contract to spend your tokens. There are two methods:

### Method 1: Standard ERC20 Approval (Pre-approve)

Use the standard `approve()` function to grant spending permission. This requires a separate transaction before the swap.

```typescript
import { ethers } from 'ethers';

// Get forwarder address from the API
const forwarderResponse = await fetch('http://localhost:3000/forwarder-address');
const { forwarderAddress } = await forwarderResponse.json();

// ERC20 approve ABI
const ERC20_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];

// Create contract instance
const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

// Approve the forwarder to spend tokens (use max uint256 for unlimited approval)
const approveTx = await tokenContract.approve(
  forwarderAddress,
  ethers.MaxUint256 // or specific amount
);
await approveTx.wait();

// Now you can build and execute the swap transaction
const buildResponse = await fetch('http://localhost:3000/build', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quote,
    params: {
      swapperAddress: wallet.address,
      destinationAddress: 'RecipientAddress',
      signerChainId: 8453,
      // No permit needed - already approved
    },
  }),
});
```

### Method 2: EIP-2612 Permit Signature (Gasless Approval)

For tokens that support EIP-2612 (like USDC), you can sign a permit message instead of sending an approval transaction. This saves gas and can be done in a single transaction.

```typescript
// 1. Get permit parameters
const permitResponse = await fetch('http://localhost:3000/permit-params', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quote,
    walletAddress: wallet.address,
  }),
});
const { permitParams } = await permitResponse.json();

// 2. Sign the permit (EIP-712 typed data)
const signature = await wallet.signTypedData(
  permitParams.domain,
  permitParams.types,
  permitParams.value
);

// 3. Parse signature components
const sig = ethers.Signature.from(signature);
const permit = {
  value: permitParams.value.value,
  deadline: permitParams.value.deadline,
  v: sig.v,
  r: sig.r,
  s: sig.s,
};

// 4. Build transaction with permit
const buildResponse = await fetch('http://localhost:3000/build', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quote,
    params: {
      swapperAddress: wallet.address,
      destinationAddress: 'RecipientAddress',
      signerChainId: 8453,
      permit, // Include the permit signature
    },
  }),
});
```

### Which Method to Use?

| Method | Pros | Cons |
|--------|------|------|
| **Pre-approve** | Works with all ERC20 tokens | Requires separate transaction (extra gas) |
| **Permit** | Single transaction, saves gas | Only works with EIP-2612 tokens |

**Tip:** Check `quote.fromToken.supportsPermit` to see if the token supports permit signatures.

## Token Address Conventions

| Chain | Native Token Address |
|-------|---------------------|
| All chains | `0x0000000000000000000000000000000000000000` |

For native tokens (SOL, SUI, ETH, etc.), use the zero address. For wrapped versions (WSOL, WETH), use the actual token contract address.

## Examples

See the `examples/` directory for complete examples:

- `examples/evm.ts` - EVM chain examples (SWIFT, MCTP, Fast MCTP, Monochain, Permit)
- `examples/solana.ts` - Solana chain examples
- `examples/sui.ts` - Sui chain examples

Run an example:

```bash
# Start the server first
bun run start

# In another terminal, run an example
bun run examples/evm.ts
```

## Testing

The project includes comprehensive E2E tests covering all supported chains and protocols.

```bash
# Run tests (quote + build only)
bun run test

# Run tests with transaction execution (requires funds)
EXECUTE=true bun run test

# Run specific test
bun run test -- --testNamePattern="Test 1"

# Watch mode
bun run test:watch
```

### Test Coverage

| Category | Tests |
|----------|-------|
| Sui -> Solana | MCTP, Native SUI |
| Sui -> EVM | MCTP to Base, Ethereum |
| Solana -> Sui | MCTP, Native SOL |
| Solana -> EVM | SWIFT, MCTP |
| EVM -> Sui | MCTP |
| EVM -> Solana | SWIFT, Fast MCTP |
| EVM -> EVM | Cross-chain SWIFT, MCTP |
| Monochain | Solana, Base |
| Permit | SWIFT with ERC20 permit |

### Test Environment Variables

```bash
# Private keys for transaction execution
SOLANA_KEY=<base58-encoded-private-key>
SUI_KEY=<suiprivkey...>
EVM_KEY=<hex-private-key>

# Enable transaction execution
EXECUTE=true
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

| Error Code | Description |
|------------|-------------|
| `INVALID_REQUEST` | Missing or invalid request parameters |
| `INVALID_SIGNATURE` | Quote signature verification failed |
| `BUILD_FAILED` | Transaction building failed |
| `INTERNAL_ERROR` | Unexpected server error |
| `UNAUTHORIZED` | Missing or invalid API key |
| `RATE_LIMITED` | Rate limit exceeded |

## Architecture

```
src/
├── index.ts          # Entry point, configuration loading
├── server.ts         # Express app, API endpoints
├── types.ts          # TypeScript interfaces
├── builders/
│   ├── index.ts      # Transaction builder router
│   ├── evm.ts        # EVM transaction builder
│   ├── svm.ts        # Solana transaction builder
│   └── sui.ts        # Sui transaction builder
├── middleware/
│   └── apiKey.ts     # API key auth and rate limiting
└── utils/
    ├── signature.ts  # Quote signature verification
    └── hypercore.ts  # HyperCore permit utilities

tests/
├── setup.ts          # Test setup
├── utils.ts          # Test utilities
└── e2e.test.ts       # End-to-end tests

examples/
├── evm.ts            # EVM examples
├── solana.ts         # Solana examples
└── sui.ts            # Sui examples
```

## Security Considerations

1. **Quote Signatures**: All quotes are cryptographically signed and verified before transaction building
2. **No Private Keys**: The service never handles user private keys; it only returns unsigned transactions
3. **RPC Security**: Use private RPC endpoints in production to prevent rate limiting and improve reliability
4. **Self-Hosting**: For production applications, self-host this service rather than using public endpoints

## Related Resources

- [Mayan Finance](https://mayan.finance) - Cross-chain swap protocol
- [Mayan Swap SDK](https://www.npmjs.com/package/@mayanfinance/swap-sdk) - Official SDK (recommended for direct integration)
- [Mayan Explorer](https://explorer.mayan.finance) - Track cross-chain swaps
- [Mayan Documentation](https://docs.mayan.finance) - Official documentation

## License

MIT
