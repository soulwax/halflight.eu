import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
	insert: vi.fn(),
	select: vi.fn()
}));

vi.mock('#lib/server/db', () => ({ db: { insert: dbMocks.insert, select: dbMocks.select } }));
vi.mock('#lib/server/log', () => ({ log: { error: vi.fn(), warn: vi.fn() } }));

import {
	__resetTrackPlayabilityCache,
	filterPlayableTracks,
	getUnplayableTrackIds,
	markTrackUnplayable
} from './track-playability';

function mockInsertChain() {
	const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
	const values = vi.fn(() => ({ onConflictDoUpdate }));
	dbMocks.insert.mockReturnValue({ values });
	return { values, onConflictDoUpdate };
}

function mockSelectChain(rows: { trackId: string }[]) {
	const where = vi.fn().mockResolvedValue(rows);
	const from = vi.fn(() => ({ where }));
	dbMocks.select.mockReturnValue({ from });
	return { from, where };
}

describe('track-playability', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		__resetTrackPlayabilityCache();
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
