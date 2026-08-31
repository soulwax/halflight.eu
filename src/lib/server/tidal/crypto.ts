import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { TidalStoreError } from './errors';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypt `plaintext` with AES-256-GCM. Returns base64 of `iv || authTag ||
 * ciphertext`, suitable for storing in a single text column.
 */
export function seal(plaintext: string, key: Buffer): string {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/**
 * Reverse {@link seal}. Throws {@link TidalStoreError} if the payload is
 * malformed or fails authentication (wrong key or tampered data).
 */
export function open(payload: string, key: Buffer): string {
	const buf = Buffer.from(payload, 'base64');
	if (buf.length <= IV_BYTES + TAG_BYTES) {
		throw new TidalStoreError('Encrypted token record is truncated or corrupt.');
	}
	const iv = buf.subarray(0, IV_BYTES);
	const authTag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
	const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
	try {
		const decipher = createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
	} catch {
		throw new TidalStoreError(
			'Could not decrypt the stored token record. The encryption key may have changed.'
		);
	}
}
