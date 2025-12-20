import { 
  Connection, 
  TransactionInstruction, 
  Keypair, 
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount
} from '@solana/web3.js';
import {
  createSwapFromSolanaInstructions,
  createMctpFromSolanaInstructions,
  createSwiftFromSolanaInstructions,
  createMonoChainFromSolanaInstructions,
  createHyperCoreDepositFromSolanaInstructions,
  getQuoteSuitableReferrerAddress,
  type Quote,
  type ReferrerAddresses,
} from '@mayanfinance/swap-sdk';
import type { BuildSvmTxParams, SvmTransactionResult, SerializedInstruction } from '../types';
import bs58 from 'bs58';

/**
 * Build unsigned SVM (Solana/Fogo) transaction
 */
export async function buildSvmTransaction(
  quote: Quote,
  params: BuildSvmTxParams,
  connection: Connection
): Promise<SvmTransactionResult> {
  const {
    swapperAddress,
    destinationAddress,
    referrerAddresses,
    customPayload,
    usdcPermitSignature,
  } = params;

  const payload = customPayload ? hexToBuffer(customPayload) : undefined;
  const referrerAddress = getQuoteSuitableReferrerAddress(quote, referrerAddresses);

  const result = await getInstructions(
    quote,
    swapperAddress,
    destinationAddress,
    referrerAddress,
    referrerAddresses,
    connection,
    payload,
    usdcPermitSignature
  );

  // Build the versioned transaction
  const swapperPubkey = new PublicKey(swapperAddress);
  const latestBlockhash = await connection.getLatestBlockhash();
  
  // Fetch lookup table accounts
  const lookupTableAccounts: AddressLookupTableAccount[] = [];
  if (result.lookupTables && result.lookupTables.length > 0) {
    for (const lt of result.lookupTables) {
      const lookupTableAccount = await connection.getAddressLookupTable(lt.key);
      if (lookupTableAccount.value) {
        lookupTableAccounts.push(lookupTableAccount.value);
      }
    }
  }

  // Create transaction message
  const messageV0 = new TransactionMessage({
    payerKey: swapperPubkey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: result.instructions,
  }).compileToV0Message(lookupTableAccounts);

  // Create versioned transaction (unsigned)
  const transaction = new VersionedTransaction(messageV0);

  // Serialize transaction to base64
  const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

  return {
    chainCategory: 'svm',
    quoteType: quote.type,
    transaction: serializedTransaction,
    signers: result.signers.length > 0 ? result.signers.map(keypairToBase58) : undefined,
    // Keep old fields for backward compatibility
    instructions: result.instructions.map(serializeInstruction),
    lookupTables: result.lookupTables.map(lt => lt.key.toBase58()),
    swapMessageV0Params: result.swapMessageV0Params ? {
      messageV0: result.swapMessageV0Params.messageV0,
      createTmpTokenAccountIxs: result.swapMessageV0Params.createTmpTokenAccountIxs.map(serializeInstruction),
      tmpTokenAccountSecretKey: bs58.encode(result.swapMessageV0Params.tmpTokenAccount.secretKey),
    } : undefined,
  };
}

async function getInstructions(
  quote: Quote,
  swapperAddress: string,
  destinationAddress: string,
  referrerAddress: string | null,
  referrerAddresses: ReferrerAddresses | undefined,
  connection: Connection,
  customPayload: Buffer | undefined,
  usdcPermitSignature: string | undefined
) {
  const options = {
    customPayload,
    usdcPermitSignature,
  };

  switch (quote.type) {
    case 'WH':
      return createSwapFromSolanaInstructions(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddresses,
        connection,
        options
      );

    case 'MCTP':
      return createMctpFromSolanaInstructions(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddress,
        connection,
        { customPayload }
      );

    case 'SWIFT':
      return createSwiftFromSolanaInstructions(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddress,
        connection,
        undefined,
        customPayload
      );

    case 'MONO_CHAIN':
      return createMonoChainFromSolanaInstructions(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddress,
        connection
      );

    case 'SHUTTLE':
      return createHyperCoreDepositFromSolanaInstructions(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddress,
        connection,
        options
      );

    case 'FAST_MCTP':
      return createMctpFromSolanaInstructions(
        quote,
        swapperAddress,
        destinationAddress,
        referrerAddress,
        connection,
        { customPayload }
      );

    default:
      throw new Error(`Unsupported quote type for SVM: ${quote.type}`);
  }
}

function serializeInstruction(ix: TransactionInstruction): SerializedInstruction {
  return {
    programId: ix.programId.toBase58(),
    keys: ix.keys.map(key => ({
      pubkey: key.pubkey.toBase58(),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: Buffer.from(ix.data).toString('base64'),
  };
}

function keypairToBase58(keypair: Keypair): string {
  return bs58.encode(keypair.secretKey);
}

function hexToBuffer(hex: string): Buffer {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex');
}

