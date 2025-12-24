import { SuiClient } from '@mysten/sui/client';
import {
  createSwapFromSuiMoveCalls,
  type Quote,
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

  const transaction = await createSwapFromSuiMoveCalls(
    quote,
    swapperAddress,
    destinationAddress,
    referrerAddresses,
    payload,
    suiClient,
    usdcPermitSignature ? { usdcPermitSignature } : undefined
  );

  // Set the sender address before building
  transaction.setSender(swapperAddress);

  // Serialize the transaction to bytes
  const serializedTx = await transaction.build({ client: suiClient });

  return {
    chainCategory: 'sui',
    quoteType: quote.type,
    transaction: Buffer.from(serializedTx).toString('base64'),
  };
}

function hexToBuffer(hex: string): Buffer {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex');
}

