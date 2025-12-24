import { startServer } from './server';
import type { ServerConfig } from './types';

// Load configuration from environment variables
const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  expectedSignerAddress: process.env.EXPECTED_SIGNER_ADDRESS || '0xe8FDd6f6D10532bd49Cced5502CAa483E232E637',
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  fogoRpcUrl: process.env.FOGO_RPC_URL || 'https://rpc.fogo.network',
  suiRpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.mainnet.sui.io',
};

// Validate required config
if (!config.expectedSignerAddress) {
  console.error('❌ EXPECTED_SIGNER_ADDRESS environment variable is required');
  process.exit(1);
}

// Start server
startServer(config);

// Export for programmatic use
export { createServer, startServer } from './server';
export { buildTransaction, buildTransactions } from './builders';
export { verifyQuoteSignature, validateQuotes } from './utils/signature';
export * from './types';

