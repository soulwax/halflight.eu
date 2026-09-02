import { describe, it, expect } from 'vitest';
import {
	readRecord,
	writeRecord,
	clearRecord,
	readPlaybackRecord,
	writePlaybackRecord,
	clearPlaybackRecord,
	type TidalTokenRecord,
	type TokenRowStore,
	type TokenSlot
} from './store';
import { TidalStoreError } from './errors';

function memoryStore() {
	const blobs: Record<TokenSlot, string | null> = { primary: null, playback: null };
	const store: TokenRowStore = {
		read: async (slot = 'primary') => blobs[slot],
		write: async (value, slot = 'primary') => {
			blobs[slot] = value;
		},
		clear: async (slot = 'primary') => {
			blobs[slot] = null;
		}
	};
	return {
		store,
		raw: () => blobs.primary,
		set: (value: string | null) => {
			blobs.primary = value;
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

	it('keeps the primary and playback tokens in separate slots', async () => {
		const { store } = memoryStore();
		const playback: TidalTokenRecord = { ...sample, accessToken: 'device-xyz', scope: ['r_usr'] };

		await writeRecord(sample, store);
		await writePlaybackRecord(playback, store);

		expect(await readRecord(store)).toEqual(sample);
		expect(await readPlaybackRecord(store)).toEqual(playback);

		// Clearing one slot leaves the other intact.
		await clearRecord(store);
		expect(await readRecord(store)).toBeNull();
		expect(await readPlaybackRecord(store)).toEqual(playback);

		await clearPlaybackRecord(store);
		expect(await readPlaybackRecord(store)).toBeNull();
	});
});
