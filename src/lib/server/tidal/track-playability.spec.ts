import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
	insert: vi.fn(),
	delete: vi.fn(),
	select: vi.fn()
}));

vi.mock('#lib/server/db', () => ({
	db: { insert: dbMocks.insert, select: dbMocks.select, delete: dbMocks.delete }
}));
vi.mock('#lib/server/log', () => ({ log: { error: vi.fn(), warn: vi.fn() } }));

import {
	__resetTrackPlayabilityCache,
	filterPlayableTracks,
	getUnplayableTrackIds,
	markTrackUnplayable,
	markTrackPlayable,
	UNPLAYABLE_TRACK_TTL_MS
} from './track-playability';

function mockInsertChain() {
	const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
	const values = vi.fn(() => ({ onConflictDoUpdate }));
	dbMocks.insert.mockReturnValue({ values });
	return { values, onConflictDoUpdate };
}

function mockSelectChain(rows: { trackId: string; checkedAt?: Date }[]) {
	const where = vi.fn().mockResolvedValue(rows.map((row) => ({ checkedAt: new Date(), ...row })));
	const from = vi.fn(() => ({ where }));
	dbMocks.select.mockReturnValue({ from });
	return { from, where };
}

describe('track-playability', () => {
	it('clears an old negative immediately after verified successful playback', async () => {
		mockInsertChain();
		await markTrackUnplayable('recovered', 'asset unavailable');
		expect(await getUnplayableTrackIds(['recovered'])).toEqual(new Set(['recovered']));
		dbMocks.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
		await markTrackPlayable('recovered');
		mockSelectChain([]);
		expect(await getUnplayableTrackIds(['recovered'])).toEqual(new Set());
	});
	beforeEach(() => {
		vi.clearAllMocks();
		__resetTrackPlayabilityCache();
	});
	afterEach(() => vi.useRealTimers());
	it('expires a local failure at 24 hours so a repaired asset can be retried', async () => {
		vi.useFakeTimers();
		mockInsertChain();
		await markTrackUnplayable('repaired', 'asset not ready for playback');
		expect(await getUnplayableTrackIds(['repaired'])).toEqual(new Set(['repaired']));
		vi.setSystemTime(Date.now() + UNPLAYABLE_TRACK_TTL_MS);
		mockSelectChain([]);
		expect(await getUnplayableTrackIds(['repaired'])).toEqual(new Set());
		expect(dbMocks.select).toHaveBeenCalledOnce();
	});
	it('keeps the original database expiry when a failure is cached later', async () => {
		vi.useFakeTimers();
		const now = Date.now();
		mockSelectChain([
			{ trackId: 'old', checkedAt: new Date(now - UNPLAYABLE_TRACK_TTL_MS + 1000) }
		]);
		expect(await getUnplayableTrackIds(['old'])).toEqual(new Set(['old']));
		vi.setSystemTime(now + 1000);
		mockSelectChain([]);
		expect(await getUnplayableTrackIds(['old'])).toEqual(new Set());
	});
	it('ignores expired database rows even when returned by the store', async () => {
		mockSelectChain([
			{ trackId: 'expired', checkedAt: new Date(Date.now() - UNPLAYABLE_TRACK_TTL_MS) }
		]);
		expect(await getUnplayableTrackIds(['expired'])).toEqual(new Set());
	});

	it('marks a track unplayable and serves it from the process cache without a DB read', async () => {
		expect.assertions(2);
		mockInsertChain();
		await markTrackUnplayable('t1', 'asset not ready for playback');

		const unplayable = await getUnplayableTrackIds(['t1']);

		expect(unplayable.has('t1')).toBe(true);
		expect(dbMocks.select).not.toHaveBeenCalled();
	});

	it('checks unseen ids against Postgres and caches a hit for next time', async () => {
		expect.assertions(3);
		mockSelectChain([{ trackId: 't2' }]);

		const first = await getUnplayableTrackIds(['t1', 't2']);
		expect(first).toEqual(new Set(['t2']));

		dbMocks.select.mockClear();
		const second = await getUnplayableTrackIds(['t2']);
		expect(second).toEqual(new Set(['t2']));
		expect(dbMocks.select).not.toHaveBeenCalled();
	});

	it('filters unplayable tracks out of a track list', async () => {
		expect.assertions(1);
		mockSelectChain([{ trackId: 'bad' }]);

		const filtered = await filterPlayableTracks([{ id: 'good' }, { id: 'bad' }]);

		expect(filtered).toEqual([{ id: 'good' }]);
	});

	it('fails open — a DB read error never hides a track that was never confirmed unplayable', async () => {
		expect.assertions(1);
		dbMocks.select.mockImplementation(() => {
			throw new Error('db unavailable');
		});

		const unplayable = await getUnplayableTrackIds(['t1']);

		expect(unplayable.size).toBe(0);
	});

	it('skips the DB entirely for an empty id list', async () => {
		expect.assertions(2);
		const unplayable = await getUnplayableTrackIds([]);

		expect(unplayable.size).toBe(0);
		expect(dbMocks.select).not.toHaveBeenCalled();
	});

	it('returns the input list unchanged when nothing is known unplayable', async () => {
		expect.assertions(1);
		mockSelectChain([]);
		const tracks = [{ id: 'a' }, { id: 'b' }];

		const filtered = await filterPlayableTracks(tracks);

		expect(filtered).toBe(tracks);
	});
});
