import {
  getSwapFromEvmTxPayload,
  getSwiftFromEvmGasLessParams,
  getQuoteSuitableReferrerAddress,
  type Quote,
  type Erc20Permit,
} from '@mayanfinance/swap-sdk';
import type { BuildEvmTxParams, EvmTransactionResult } from '../types';

/**
 * Build unsigned EVM transaction based on quote type
 * 
 * For gasless SWIFT quotes: Returns typed data for EIP-712 signing (no on-chain tx)
 * For all other quotes: Returns transaction calldata for eth_sendRawTransaction
 */
export async function buildEvmTransaction(
  quote: Quote,
  params: BuildEvmTxParams
): Promise<EvmTransactionResult> {
  const { 
    swapperAddress, 
    destinationAddress, 
    signerChainId, 
    permit, 
    referrerAddresses,
    customPayload,
    usdcPermitSignature 
  } = params;

  const payload = customPayload ? hexToBuffer(customPayload) : undefined;
  const permitParam: Erc20Permit | undefined = permit;

  // Gasless SWIFT: User signs typed data, relayer submits on-chain
  if (quote.type === 'SWIFT' && quote.gasless) {
    const referrerAddress = getQuoteSuitableReferrerAddress(quote, referrerAddresses);
    const gaslessParams = getSwiftFromEvmGasLessParams(
      quote,
      swapperAddress,
      destinationAddress,
      referrerAddress,
      signerChainId,
      permitParam,
      payload
    );

    return {
      chainCategory: 'evm',
      quoteType: quote.type,
      gasless: true,
      // No transaction for gasless - user signs typed data instead
      typedData: {
        domain: gaslessParams.orderTypedData.domain,
        types: gaslessParams.orderTypedData.types,
        value: gaslessParams.orderTypedData.value,
        primaryType: 'CreateOrder',
      },
      orderParams: gaslessParams.orderParams,
      orderHash: gaslessParams.orderHash,
      permitParams: gaslessParams.permitParams,
    };
  }

  // Non-gasless: Build transaction calldata
  const txPayload = await getSwapFromEvmTxPayload(
    quote,
    swapperAddress,
    destinationAddress,
    referrerAddresses,
    swapperAddress,
    signerChainId,
    payload,
    permitParam,
    usdcPermitSignature ? { usdcPermitSignature } : undefined
  );

  // Resolve the 'to' address if it's a promise
  const toAddress = typeof txPayload.to === 'string' 
    ? txPayload.to 
    : await txPayload.to;

  return {
    chainCategory: 'evm',
    quoteType: quote.type,
    gasless: false,
    transaction: {
      to: toAddress as string,
      data: txPayload.data as string,
      value: txPayload.value?.toString() ?? '0',
      chainId: typeof signerChainId === 'number' ? signerChainId : parseInt(signerChainId),
    },
    forwarderParams: txPayload._forwarder ? {
      method: txPayload._forwarder.method,
      params: txPayload._forwarder.params,
    } : undefined,
  };
}

function hexToBuffer(hex: string): Buffer {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex');
}

