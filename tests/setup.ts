import 'dotenv/config';

// Ensure required env variables exist for test execution
if (!process.env.SOLANA_KEY && !process.env.SUI_KEY && !process.env.EVM_KEY) {
  console.warn('Warning: No private keys found in environment. Tests will only verify transaction building, not execution.');
}
