import { startServer } from './server';
import type { ServerConfig } from './types';

// EVM RPC URLs by chain ID - environment variables with fallback defaults
const evmRpcUrls: Record<number, string> = {
  1: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
  56: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
  137: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  43114: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  42161: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  10: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
  8453: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  130: process.env.UNICHAIN_RPC_URL || 'https://mainnet.unichain.org',
  59144: process.env.LINEA_RPC_URL || 'https://rpc.linea.build',
  146: process.env.SONIC_RPC_URL || 'https://rpc.soniclabs.com',
  999: process.env.HYPEREVM_RPC_URL || 'https://rpc.hyperliquid.xyz/evm',
  143: process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz',
};

// Load configuration from environment variables
const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
  expectedSignerAddress: process.env.EXPECTED_SIGNER_ADDRESS || '0xe8FDd6f6D10532bd49Cced5502CAa483E232E637',
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  fogoRpcUrl: process.env.FOGO_RPC_URL || 'https://rpc.fogo.network',
  suiRpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.mainnet.sui.io',
  evmRpcUrls,
};

// Validate required config
if (!config.expectedSignerAddress) {
  console.error('❌ EXPECTED_SIGNER_ADDRESS environment variable is required');
  process.exit(1);
}

// Start server
startServer(config);

// Export for programmatic use
export { createServer, createMetricsServer, startServer } from './server';
export { buildTransaction, buildTransactions } from './builders';
export { verifyQuoteSignature, validateQuotes } from './utils/signature';
export * from './types';

