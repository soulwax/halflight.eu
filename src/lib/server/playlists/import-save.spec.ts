import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	read: vi.fn(),
	lock: vi.fn(),
	set: vi.fn(),
	values: vi.fn(),
	ensure: vi.fn()
}));
vi.mock('./index', () => ({ ensurePlaylistTable: mocks.ensure }));
vi.mock('#lib/server/db', () => ({
	db: {
		transaction: async (work: (tx: unknown) => unknown) =>
			work({
				execute: mocks.lock,
				select: () => ({
					from: () => ({
						where: () => ({ orderBy: () => ({ limit: () => ({ for: mocks.read }) }) })
					})
				}),
				update: () => ({ set: mocks.set }),
				insert: () => ({ values: mocks.values })
			})
	}
}));
import { saveVerifiedImport } from './import-save';
import type { SavedPlaylist } from './index';
const track = { kind: 'track' as const, id: '1', title: 'Song', artists: [] };
const row = {
	id: 'local',
	title: 'Old',
	description: null,
	itemsJson: JSON.stringify([track]),
	updatedAt: new Date('2026-10-08T12:00:00Z'),
	syncStatus: 'synced'
};
const expected = {
	...row,
	userId: 'owner',
	items: [track],
	updatedAt: row.updatedAt.toISOString(),
	createdAt: row.updatedAt.toISOString(),
	source: 'tidal',
	tidalPlaylistId: 'remote'
} as SavedPlaylist;
const input = {
	userId: 'owner',
	tidalPlaylistId: 'remote',
	title: 'Imported',
	items: [track, track],
	expected: undefined as SavedPlaylist | undefined
};
beforeEach(() => {
	vi.clearAllMocks();
	mocks.read.mockResolvedValue([]);
	mocks.set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
	mocks.values.mockResolvedValue(undefined);
});
describe('atomic verified import commit', () => {
	it('locks the source and inserts a fully synced playlist with duplicate occurrences in one transaction', async () => {
		expect(await saveVerifiedImport(input)).toMatchObject({ status: 'created' });
		expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.read.mock.invocationCallOrder[0]
		);
		expect(mocks.values).toHaveBeenCalledWith(
			expect.objectContaining({
				itemsJson: JSON.stringify([track, track]),
				syncStatus: 'synced',
				lastSyncedAt: expect.any(Date),
				userId: 'owner'
			})
		);
		expect(mocks.set).not.toHaveBeenCalled();
	});
	it('cannot create a duplicate if another import committed while validation ran', async () => {
		mocks.read.mockResolvedValue([row]);
		expect(await saveVerifiedImport(input)).toEqual({ id: 'local', status: 'conflict' });
		expect(mocks.values).not.toHaveBeenCalled();
		expect(mocks.set).not.toHaveBeenCalled();
	});
	it.each(['local_only', 'pending_push'])(
		'preserves %s edits made during verification',
		async (syncStatus) => {
			mocks.read.mockResolvedValue([{ ...row, syncStatus }]);
			expect(await saveVerifiedImport({ ...input, expected })).toMatchObject({
				status: 'conflict'
			});
			expect(mocks.set).not.toHaveBeenCalled();
		}
	);
	it('preserves edits and accepted recording replacements even if the sync status remains synced', async () => {
		mocks.read.mockResolvedValue([{ ...row, itemsJson: JSON.stringify([{ ...track, id: '2' }]) }]);
		expect(await saveVerifiedImport({ ...input, expected })).toMatchObject({ status: 'conflict' });
		expect(mocks.set).not.toHaveBeenCalled();
	});
	it('does not resurrect a playlist deleted during verification', async () => {
		expect(await saveVerifiedImport({ ...input, expected })).toEqual({
			id: 'local',
			status: 'conflict'
		});
		expect(mocks.values).not.toHaveBeenCalled();
	});
	it('updates the unchanged owned snapshot atomically', async () => {
		mocks.read.mockResolvedValue([row]);
		expect(await saveVerifiedImport({ ...input, expected })).toEqual({
			id: 'local',
			status: 'synced'
		});
		expect(mocks.set).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Imported',
				itemsJson: JSON.stringify([track, track]),
				syncError: null
			})
		);
	});
});
