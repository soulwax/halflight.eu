import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { seal, open } from './crypto';
import { TidalStoreError } from './errors';

const key = randomBytes(32);

describe('tidal crypto', () => {
	it('round-trips plaintext', () => {
		const payload = JSON.stringify({ accessToken: 'a'.repeat(120), n: 42 });
		const sealed = seal(payload, key);
		expect(sealed).not.toContain('accessToken');
		expect(open(sealed, key)).toBe(payload);
	});

	it('produces a different ciphertext each time (random IV)', () => {
		expect(seal('same', key)).not.toBe(seal('same', key));
	});

	it('rejects the wrong key', () => {
		const sealed = seal('secret', key);
		expect(() => open(sealed, randomBytes(32))).toThrow(TidalStoreError);
	});

	it('rejects tampered ciphertext', () => {
		const buf = Buffer.from(seal('secret value', key), 'base64');
		buf[buf.length - 1] ^= 0xff;
		expect(() => open(buf.toString('base64'), key)).toThrow(TidalStoreError);
	});

	it('rejects a truncated payload', () => {
		expect(() => open('AAAA', key)).toThrow(TidalStoreError);
	});
});
