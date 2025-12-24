import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import {
  createSwapFromSuiMoveCalls,
  type Quote,
  type ComposableSuiMoveCallsOptions,
} from '@mayanfinance/swap-sdk';
import type { BuildSuiTxParams, SuiTransactionResult, SuiCoinInput } from '../types';

/**
 * Convert our SuiCoinInput type to SDK's SuiFunctionParameter format
 */
function convertCoinInput(coinInput: SuiCoinInput | undefined): ComposableSuiMoveCallsOptions['inputCoin'] {
  if (!coinInput) return undefined;

  if ('objectId' in coinInput) {
    return { objectId: coinInput.objectId };
  }

  if ('result' in coinInput) {
    return { result: coinInput.result as any };
  }

  return undefined;
}

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
    inputCoin,
    whFeeCoin,
    builtTransaction,
  } = params;

  const payload = customPayload ? hexToBuffer(customPayload) : undefined;

  // Build composable options
  const options: ComposableSuiMoveCallsOptions = {};

  if (usdcPermitSignature) {
    options.usdcPermitSignature = usdcPermitSignature;
  }

  if (inputCoin) {
    options.inputCoin = convertCoinInput(inputCoin);
  }

  if (whFeeCoin) {
    options.whFeeCoin = convertCoinInput(whFeeCoin);
  }

  if (builtTransaction) {
    const txBytes = Buffer.from(builtTransaction, 'base64');
    options.builtTransaction = Transaction.from(txBytes);
  }

  const transaction = await createSwapFromSuiMoveCalls(
    quote,
    swapperAddress,
    destinationAddress,
    referrerAddresses,
    payload,
    suiClient,
    Object.keys(options).length > 0 ? options : undefined
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

