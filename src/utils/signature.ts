import { ethers } from 'ethers';
import type { SignedQuote } from '../types';

/**
 * Sort object keys recursively for canonical JSON representation
 */
function sortObjectKeys(obj: any): any {
	if (obj === null || obj === undefined) {
		return obj;
	}
	if (Array.isArray(obj)) {
		return obj.map(sortObjectKeys);
	}
	if (typeof obj === 'object') {
		const sorted: any = {};
		Object.keys(obj).sort().forEach(key => {
			sorted[key] = sortObjectKeys(obj[key]);
		});
		return sorted;
	}
	return obj;
}


/**
 * Remove null and undefined values from object
 */
export function removeNullAndUndefined(obj: any): any {
	if (obj === null || obj === undefined || (typeof obj === 'number' && !Number.isFinite(obj))) {
		return undefined;
	}
	if (Array.isArray(obj)) {
		return obj.map(removeNullAndUndefined).filter(v => v !== undefined && v !== null);
	}
	if (typeof obj === 'object') {
		const result: any = {};
		for (const [key, value] of Object.entries(obj)) {
			const cleaned = removeNullAndUndefined(value);
			if (cleaned !== undefined && cleaned !== null) {
				result[key] = cleaned;
			}
		}
		return result;
	}
	return obj;
}

/**
 * JSON replacer for BigInt and other special types
 */
export function jsonReplacer(_key: string, value: any) {
    if (typeof value === 'bigint') {
        return `${value.toString()}n` // add 'n' to identify BigInt
    }

	if (value === undefined) {
		return null;
	}

    return value;
}

export function verifyQuoteSignature(
  quote: SignedQuote, 
  expectedSignerAddress: string
): boolean {
  const { signature, ...quoteWithoutSignature } = quote;
  
  if (!signature) {
    return false;
  }

  try {
    const quoteWithoutNullOrUndefinedValues = removeNullAndUndefined(quoteWithoutSignature);
    const sortedQuote = sortObjectKeys(quoteWithoutNullOrUndefinedValues);
    const quoteString = JSON.stringify(sortedQuote, jsonReplacer);

    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(quoteString));
    const prefixedHash = ethers.hashMessage(ethers.getBytes(messageHash));

    const recoveredAddress = ethers.recoverAddress(prefixedHash, signature);

    return recoveredAddress.toLowerCase() === expectedSignerAddress.toLowerCase();
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

export function validateQuotes(
  quotes: SignedQuote[],
  expectedSignerAddress: string
): { valid: boolean; invalidIndexes: number[] } {
  const invalidIndexes: number[] = [];

  for (let i = 0; i < quotes.length; i++) {
    if (!verifyQuoteSignature(quotes[i], expectedSignerAddress)) {
      invalidIndexes.push(i);
    }
  }

  return {
    valid: invalidIndexes.length === 0,
    invalidIndexes
  };
}

