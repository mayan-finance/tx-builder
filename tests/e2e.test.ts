import { describe, it, expect, beforeAll } from 'vitest';
import {
  fetchQuote,
  buildTransaction,
  executeSolanaTransaction,
  executeSuiTransaction,
  executeEvmTransaction,
  waitForSwapIndexed,
  checkSolanaBalance,
  checkSuiBalance,
  checkEvmBalance,
  fetchPermitParams,
  signPermit,
  getAddresses,
  CHAIN_IDS,
} from './utils';

// Get addresses from env keypairs or use defaults
const ADDRESSES = getAddresses();

/**
 * E2E Tests for Mayan TX Builder
 *
 * These tests verify the full flow: fetchQuote -> buildTransaction -> execute
 *
 * To run with execution (requires private keys and funds):
 *   EXECUTE=true bun test
 *
 * Environment variables:
 *   - SOLANA_KEY: Base58 encoded Solana private key
 *   - SUI_KEY: Sui private key (suiprivkey... format)
 *   - EVM_KEY: Hex encoded EVM private key
 *   - EXECUTE: Set to "true" to execute transactions
 */

describe('E2E: Sui -> Solana', () => {
  // Test 1: Sui -> Solana (MCTP)
  it('Test 1: Sui USDC -> Solana USDC via MCTP', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
    const toToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const fromChain = 'sui';
    const toChain = 'solana';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    // Check balance before execution
    if (process.env.EXECUTE === 'true') {
      await checkSuiBalance(fromToken, ADDRESSES.sui, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      mctp: true,
    });

    expect(quote).toBeDefined();
    expect(quote.type).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.sui,
      destinationAddress: ADDRESSES.solana,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('sui');
    expect(result.transaction.transaction).toBeDefined();

    const txHash = await executeSuiTransaction(result);
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });

  // Test 2: Sui -> Solana (MCTP with native SUI)
  it('Test 2: Sui SUI -> Solana USDC via MCTP', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0x2::sui::SUI';
    const toToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const fromChain = 'sui';
    const toChain = 'solana';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '1000000000'; // 1 SUI (9 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkSuiBalance(fromToken, ADDRESSES.sui, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      mctp: true,
    });

    expect(quote).toBeDefined();
    expect(quote.type).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.sui,
      destinationAddress: ADDRESSES.solana,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('sui');

    const txHash = await executeSuiTransaction(result);
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });
});

describe('E2E: Sui -> EVM', () => {
  // Test 3: Sui -> Base (MCTP)
  it('Test 3: Sui USDC -> Base USDC via MCTP', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
    const toToken = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    const fromChain = 'sui';
    const toChain = 'base';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkSuiBalance(fromToken, ADDRESSES.sui, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      mctp: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.sui,
      destinationAddress: ADDRESSES.evm,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('sui');

    const txHash = await executeSuiTransaction(result);
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });

  // Test 4: Sui -> Ethereum (MCTP)
  it('Test 4: Sui USDC -> Ethereum USDC via MCTP', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
    const toToken = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const fromChain = 'sui';
    const toChain = 'ethereum';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '5000000'; // 5 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkSuiBalance(fromToken, ADDRESSES.sui, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      mctp: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.sui,
      destinationAddress: ADDRESSES.evm,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('sui');

    const txHash = await executeSuiTransaction(result);
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });
});

describe('E2E: Solana -> Sui', () => {
  // Test 5: Solana -> Sui (MCTP)
  it('Test 5: Solana USDC -> Sui USDC via MCTP', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const toToken = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
    const fromChain = 'solana';
    const toChain = 'sui';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkSolanaBalance(fromToken, ADDRESSES.solana, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      mctp: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.solana,
      destinationAddress: ADDRESSES.sui,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('svm');

    const txHash = await executeSolanaTransaction(result);
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });

  // Test 6: Solana -> Sui (MCTP with native SOL)
  it('Test 6: Solana SOL -> Sui USDC via MCTP', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = 'So11111111111111111111111111111111111111112';
    const toToken = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
    const fromChain = 'solana';
    const toChain = 'sui';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '100000000'; // 0.1 SOL (9 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkSolanaBalance(fromToken, ADDRESSES.solana, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      mctp: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.solana,
      destinationAddress: ADDRESSES.sui,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('svm');

    const txHash = await executeSolanaTransaction(result);
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });
});

describe('E2E: Solana -> EVM', () => {
  // Test 7: Solana -> Base (SWIFT)
  it('Test 7: Solana USDC -> Base USDC via SWIFT', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const toToken = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    const fromChain = 'solana';
    const toChain = 'base';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkSolanaBalance(fromToken, ADDRESSES.solana, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      swift: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.solana,
      destinationAddress: ADDRESSES.evm,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('svm');

    const txHash = await executeSolanaTransaction(result);
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });

  // Test 8: Solana -> Base (MCTP)
  it('Test 8: Solana USDC -> Base USDC via MCTP', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const toToken = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    const fromChain = 'solana';
    const toChain = 'base';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkSolanaBalance(fromToken, ADDRESSES.solana, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      mctp: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.solana,
      destinationAddress: ADDRESSES.evm,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('svm');

    const txHash = await executeSolanaTransaction(result);
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });

  // Test 9: Solana -> Arbitrum (SWIFT)
  it('Test 9: Solana USDC -> Arbitrum USDC via SWIFT', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const toToken = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const fromChain = 'solana';
    const toChain = 'arbitrum';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkSolanaBalance(fromToken, ADDRESSES.solana, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      swift: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.solana,
      destinationAddress: ADDRESSES.evm,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('svm');

    const txHash = await executeSolanaTransaction(result);
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });
});

describe('E2E: EVM -> Sui', () => {
  // Test 10: Base -> Sui (MCTP)
  it('Test 10: Base USDC -> Sui USDC via MCTP', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    const toToken = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
    const fromChain = 'base';
    const toChain = 'sui';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkEvmBalance(fromToken, ADDRESSES.evm, fromChain, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      mctp: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.evm,
      destinationAddress: ADDRESSES.sui,
      signerChainId: CHAIN_IDS.base,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('evm');

    const txHash = await executeEvmTransaction(result, 'base');
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });

  // Test 11: Ethereum -> Sui (MCTP)
  it('Test 11: Ethereum USDC -> Sui USDC via MCTP', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const toToken = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
    const fromChain = 'ethereum';
    const toChain = 'sui';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '5000000'; // 5 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkEvmBalance(fromToken, ADDRESSES.evm, fromChain, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      mctp: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.evm,
      destinationAddress: ADDRESSES.sui,
      signerChainId: CHAIN_IDS.ethereum,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('evm');

    const txHash = await executeEvmTransaction(result, 'ethereum');
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });
});

describe('E2E: EVM -> Solana', () => {
  // Test 12: Base -> Solana (SWIFT)
  it('Test 12: Base USDC -> Solana USDC via SWIFT', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    const toToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const fromChain = 'base';
    const toChain = 'solana';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkEvmBalance(fromToken, ADDRESSES.evm, fromChain, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      swift: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.evm,
      destinationAddress: ADDRESSES.solana,
      signerChainId: CHAIN_IDS.base,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('evm');

    const txHash = await executeEvmTransaction(result, 'base');
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });

  // Test 13: Base -> Solana (Fast MCTP)
  it('Test 13: Base USDC -> Solana USDC via Fast MCTP', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    const toToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const fromChain = 'base';
    const toChain = 'solana';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkEvmBalance(fromToken, ADDRESSES.evm, fromChain, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      fastMctp: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.evm,
      destinationAddress: ADDRESSES.solana,
      signerChainId: CHAIN_IDS.base,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('evm');

    const txHash = await executeEvmTransaction(result, 'base');
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });

  // Test 14: Arbitrum -> Solana (SWIFT)
  it('Test 14: Arbitrum USDC -> Solana USDC via SWIFT', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const toToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const fromChain = 'arbitrum';
    const toChain = 'solana';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkEvmBalance(fromToken, ADDRESSES.evm, fromChain, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      swift: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.evm,
      destinationAddress: ADDRESSES.solana,
      signerChainId: CHAIN_IDS.arbitrum,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('evm');

    const txHash = await executeEvmTransaction(result, 'arbitrum');
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });

  // Test 15: Polygon -> Solana (SWIFT)
  it('Test 15: Polygon USDC -> Solana USDC via SWIFT', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    const toToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const fromChain = 'polygon';
    const toChain = 'solana';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkEvmBalance(fromToken, ADDRESSES.evm, fromChain, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      swift: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.evm,
      destinationAddress: ADDRESSES.solana,
      signerChainId: CHAIN_IDS.polygon,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('evm');

    const txHash = await executeEvmTransaction(result, 'polygon');
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });
});

describe('E2E: EVM -> EVM (Cross-chain)', () => {
  // Test 16: Base -> Arbitrum (SWIFT)
  it('Test 16: Base USDC -> Arbitrum USDC via SWIFT', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    const toToken = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const fromChain = 'base';
    const toChain = 'arbitrum';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkEvmBalance(fromToken, ADDRESSES.evm, fromChain, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      swift: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.evm,
      destinationAddress: ADDRESSES.evm,
      signerChainId: CHAIN_IDS.base,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('evm');

    const txHash = await executeEvmTransaction(result, 'base');
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });

  // Test 17: Arbitrum -> Polygon (MCTP)
  it('Test 17: Arbitrum USDC -> Polygon USDC via MCTP', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const toToken = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
    const fromChain = 'arbitrum';
    const toChain = 'polygon';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkEvmBalance(fromToken, ADDRESSES.evm, fromChain, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      mctp: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.evm,
      destinationAddress: ADDRESSES.evm,
      signerChainId: CHAIN_IDS.arbitrum,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('evm');

    const txHash = await executeEvmTransaction(result, 'arbitrum');
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });

  // Test 18: Ethereum -> Base (SWIFT)
  it('Test 18: Ethereum USDC -> Base USDC via SWIFT', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const toToken = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    const fromChain = 'ethereum';
    const toChain = 'base';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '5000000'; // 5 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkEvmBalance(fromToken, ADDRESSES.evm, fromChain, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      swift: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.evm,
      destinationAddress: ADDRESSES.evm,
      signerChainId: CHAIN_IDS.ethereum,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('evm');

    const txHash = await executeEvmTransaction(result, 'ethereum');
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });
});

describe('E2E: Monochain Swaps', () => {
  // Test 19: Solana Monochain (SOL -> USDC)
  it('Test 19: Solana SOL -> USDC (Monochain)', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = 'So11111111111111111111111111111111111111112';
    const toToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const fromChain = 'solana';
    const toChain = 'solana';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '20000000'; // 0.02 SOL (9 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkSolanaBalance(fromToken, ADDRESSES.solana, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      monoChain: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.solana,
      destinationAddress: ADDRESSES.solana,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('svm');

    const txHash = await executeSolanaTransaction(result);
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });

  // Test 20: Base Monochain (ETH -> USDC)
  it('Test 20: Base ETH -> USDC (Monochain)', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0x0000000000000000000000000000000000000000';
    const toToken = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    const fromChain = 'base';
    const toChain = 'base';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '300000000000000'; // 0.0003 ETH (18 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkEvmBalance(fromToken, ADDRESSES.evm, fromChain, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      monoChain: true,
    });

    expect(quote).toBeDefined();

    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.evm,
      destinationAddress: ADDRESSES.evm,
      signerChainId: CHAIN_IDS.base,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('evm');

    const txHash = await executeEvmTransaction(result, 'base');
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });
});

describe('E2E: EVM with Permit', () => {
  // Test 21: Base -> Solana with Permit (SWIFT)
  it('Test 21: Base USDC -> Solana USDC via SWIFT with Permit', async () => {
    // ============ FILL THESE VALUES ============
    const fromToken = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    const toToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const fromChain = 'base';
    const toChain = 'solana';
    const slippage: 'auto' | number = 'auto';
    const amountIn64 = '3000000'; // 3 USDC (6 decimals)
    // ===========================================

    if (process.env.EXECUTE === 'true') {
      await checkEvmBalance(fromToken, ADDRESSES.evm, fromChain, BigInt(amountIn64));
    }

    const quote = await fetchQuote({
      fromToken,
      fromChain,
      toToken,
      toChain,
      amountIn64,
      slippageBps: slippage,
      swift: true,
    });

    expect(quote).toBeDefined();
    expect(quote.type).toBe('SWIFT');

    // Get permit params from the server
    const permitParams = await fetchPermitParams(quote, ADDRESSES.evm);
    expect(permitParams).toBeDefined();
    expect(permitParams.domain).toBeDefined();
    expect(permitParams.types).toBeDefined();
    expect(permitParams.value).toBeDefined();

    // Sign permit if executing
    let permit;
    if (process.env.EXECUTE === 'true') {
      permit = await signPermit(permitParams, fromChain);
      expect(permit.v).toBeDefined();
      expect(permit.r).toBeDefined();
      expect(permit.s).toBeDefined();
    }

    // Build transaction with permit
    const result = await buildTransaction(quote, {
      swapperAddress: ADDRESSES.evm,
      destinationAddress: ADDRESSES.solana,
      signerChainId: CHAIN_IDS.base,
      permit,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.chainCategory).toBe('evm');
    expect(result.transaction.transaction).toBeDefined();

    const txHash = await executeEvmTransaction(result, 'base');
    if (txHash) {
      console.log('Tx hash:', txHash);
      const swapData = await waitForSwapIndexed(txHash);
      console.log('Swap indexed:', swapData.status);
    }
  });
});
