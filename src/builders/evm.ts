import {
  getSwapFromEvmTxPayload,
  getMctpFromEvmTxPayload,
  getSwiftFromEvmTxPayload,
  getSwiftFromEvmGasLessParams,
  getFastMctpFromEvmTxPayload,
  getMonoChainFromEvmTxPayload,
  getHyperCoreDepositFromEvmTxPayload,
  getQuoteSuitableReferrerAddress,
  type Quote,
  type Erc20Permit,
  type ReferrerAddresses,
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
  const referrerAddress = getQuoteSuitableReferrerAddress(quote, referrerAddresses);
  const permitParam: Erc20Permit | undefined = permit;

  // Gasless SWIFT: User signs typed data, relayer submits on-chain
  if (quote.type === 'SWIFT' && quote.gasless) {
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
  const txPayload = await getTransactionPayload(
    quote,
    swapperAddress,
    destinationAddress,
    referrerAddress,
    referrerAddresses,
    signerChainId,
    permitParam,
    payload,
    usdcPermitSignature
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

async function getTransactionPayload(
  quote: Quote,
  swapperAddress: string,
  destinationAddress: string,
  referrerAddress: string | null,
  referrerAddresses: ReferrerAddresses | undefined,
  signerChainId: number | string,
  permit: Erc20Permit | undefined,
  payload: Buffer | undefined,
  usdcPermitSignature: string | undefined
) {
  const options = usdcPermitSignature ? { usdcPermitSignature } : undefined;

  switch (quote.type) {
    case 'WH':
      return getSwapFromEvmTxPayload(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddresses,
        swapperAddress,
        signerChainId,
        payload,
        permit,
        options
      );

    case 'MCTP':
      return getMctpFromEvmTxPayload(
        quote,
        destinationAddress,
        referrerAddress,
        signerChainId,
        permit,
        payload
      );

    case 'SWIFT':
      return getSwiftFromEvmTxPayload(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddress,
        signerChainId,
        permit,
        payload
      );

    case 'FAST_MCTP':
      return getFastMctpFromEvmTxPayload(
        quote,
        destinationAddress,
        referrerAddress,
        signerChainId,
        permit,
        payload
      );

    case 'MONO_CHAIN':
      return getMonoChainFromEvmTxPayload(
        quote,
        destinationAddress,
        referrerAddress,
        signerChainId,
        permit
      );

    case 'SHUTTLE':
      // HyperCore deposit (for hypercore destination)
      return getHyperCoreDepositFromEvmTxPayload(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddress,
        signerChainId,
        permit,
        payload,
        options
      );

    default:
      throw new Error(`Unsupported quote type for EVM: ${quote.type}`);
  }
}

function hexToBuffer(hex: string): Buffer {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex');
}

