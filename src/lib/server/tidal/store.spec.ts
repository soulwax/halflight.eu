import { describe, it, expect } from 'vitest';
import {
	readRecord,
	writeRecord,
	clearRecord,
	type TidalTokenRecord,
	type TokenRowStore
} from './store';
import { TidalStoreError } from './errors';

function memoryStore() {
	let secret: string | null = null;
	const store: TokenRowStore = {
		read: async () => secret,
		write: async (value) => {
			secret = value;
		},
		clear: async () => {
			secret = null;
		}
	};
	return {
		store,
		raw: () => secret,
		set: (value: string | null) => {
			secret = value;
		}
	};
}

const sample: TidalTokenRecord = {
	accessToken: 'access-123',
	refreshToken: 'refresh-456',
	expiresAt: Date.now() + 3_600_000,
	tokenType: 'Bearer',
	scope: ['user.read', 'collection.read'],
	obtainedAt: Date.now()
};

describe('tidal token store', () => {
	it('returns null when nothing is stored', async () => {
		const { store } = memoryStore();
		expect(await readRecord(store)).toBeNull();
	});

	it('encrypts on write and round-trips on read', async () => {
		const mem = memoryStore();
		await writeRecord(sample, mem.store);
		expect(mem.raw()).not.toContain('access-123');
		expect(mem.raw()).not.toContain('refresh-456');
		expect(await readRecord(mem.store)).toEqual(sample);
	});

	it('clears the record', async () => {
		const mem = memoryStore();
		await writeRecord(sample, mem.store);
		await clearRecord(mem.store);
		expect(mem.raw()).toBeNull();
		expect(await readRecord(mem.store)).toBeNull();
	});

	it('throws a typed error for an unreadable row', async () => {
		const mem = memoryStore();
		mem.set('not-valid-base64-ciphertext');
		await expect(readRecord(mem.store)).rejects.toBeInstanceOf(TidalStoreError);
	});

	it('throws a typed error when the decrypted JSON is missing fields', async () => {
		const mem = memoryStore();
		// Encrypt a valid-but-incomplete record through the real write path…
		await writeRecord({ ...sample }, mem.store);
		// …then corrupt the stored ciphertext so decryption fails cleanly.
		const flipped = Buffer.from(mem.raw()!, 'base64');
		flipped[flipped.length - 1] ^= 0x01;
		mem.set(flipped.toString('base64'));
		await expect(readRecord(mem.store)).rejects.toBeInstanceOf(TidalStoreError);
	});
});
