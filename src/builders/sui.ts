import { SuiClient } from '@mysten/sui/client';
import {
  createSwapFromSuiMoveCalls,
  createMctpFromSuiMoveCalls,
  createHyperCoreDepositFromSuiMoveCalls,
  getQuoteSuitableReferrerAddress,
  type Quote,
  type ReferrerAddresses,
} from '@mayanfinance/swap-sdk';
import type { BuildSuiTxParams, SuiTransactionResult } from '../types';

/**
 * Build unsigned SUI transaction
 */
export async function buildSuiTransaction(
  quote: Quote,
  params: BuildSuiTxParams,
  suiClient: SuiClient
): Promise<SuiTransactionResult> {
  const {
    swapperAddress,
    destinationAddress,
    referrerAddresses,
    customPayload,
    usdcPermitSignature,
  } = params;

  const payload = customPayload ? hexToBuffer(customPayload) : undefined;
  const referrerAddress = getQuoteSuitableReferrerAddress(quote, referrerAddresses);

  const transaction = await getTransaction(
    quote,
    swapperAddress,
    destinationAddress,
    referrerAddress,
    referrerAddresses,
    suiClient,
    payload,
    usdcPermitSignature
  );

  // Serialize the transaction to bytes
  const serializedTx = await transaction.build({ client: suiClient });

  return {
    chainCategory: 'sui',
    quoteType: quote.type,
    transaction: Buffer.from(serializedTx).toString('base64'),
  };
}

async function getTransaction(
  quote: Quote,
  swapperAddress: string,
  destinationAddress: string,
  referrerAddress: string | null,
  referrerAddresses: ReferrerAddresses | undefined,
  suiClient: SuiClient,
  customPayload: Buffer | undefined,
  usdcPermitSignature: string | undefined
) {
  const options = usdcPermitSignature ? { usdcPermitSignature } : undefined;

  switch (quote.type) {
    case 'WH':
    case 'SWIFT':
    case 'FAST_MCTP':
      // Generic swap from Sui handles multiple quote types
      return createSwapFromSuiMoveCalls(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddresses,
        customPayload,
        suiClient,
        options
      );

    case 'MCTP':
      return createMctpFromSuiMoveCalls(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddress,
        customPayload,
        suiClient,
        options
      );

    case 'SHUTTLE':
      // HyperCore deposit from Sui
      return createHyperCoreDepositFromSuiMoveCalls(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddress,
        suiClient,
        options
      );

    case 'MONO_CHAIN':
      // Mono chain on Sui uses same as generic swap
      return createSwapFromSuiMoveCalls(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddresses,
        customPayload,
        suiClient,
        options
      );

    default:
      throw new Error(`Unsupported quote type for SUI: ${quote.type}`);
  }
}

function hexToBuffer(hex: string): Buffer {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex');
}

