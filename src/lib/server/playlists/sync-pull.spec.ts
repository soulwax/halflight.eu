import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackSummary } from '#lib/tidal/models';
import type { Cookies } from '@sveltejs/kit';

const mocks = vi.hoisted(() => ({
	fetch: vi.fn(),
	normalise: vi.fn(),
	validate: vi.fn(),
	settings: vi.fn(),
	list: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	save: vi.fn()
}));
vi.mock('#lib/server/tidal/api', async (importOriginal) => ({
	...(await importOriginal<object>()),
	getFullPlaylist: mocks.fetch
}));
vi.mock('#lib/server/tidal/normalise', () => ({ normalisePlaylistDetail: mocks.normalise }));
vi.mock('./import-metadata', () => ({ resolveImportMetadata: mocks.normalise }));
vi.mock('./recording-verification', () => ({
	verifyImportedRecordings: async (...args: unknown[]) => {
		const tracks = await mocks.validate(...args);
		return {
			tracks,
			replacements: 0,
			bestFits: 0,
			skipped: (args[0] as unknown[]).length - tracks.length
		};
	}
}));
vi.mock('#lib/server/streaming-settings', () => ({ getStreamingSettings: mocks.settings }));
vi.mock('./index', () => ({
	getUserPlaylists: mocks.list,
	createUserPlaylist: mocks.create,
	updateUserPlaylist: mocks.update
}));
vi.mock('./import-save', () => ({ saveVerifiedImport: mocks.save }));
import { pullPlaylist, pushAllPlaylists } from './sync';

const good: TrackSummary = { kind: 'track', id: '1', title: 'Playable', artists: [] };
const bad: TrackSummary = { kind: 'track', id: '2', title: 'Defective', artists: [] };
const items = [good, bad, good];
const ctx = { userId: 'owner', fetch, cookies: {} as Cookies };

beforeEach(() => {
	mocks.fetch.mockReset().mockResolvedValue({ data: { id: 'remote' } });
	mocks.normalise.mockReset().mockReturnValue({ id: 'remote', title: 'Playlist', items });
	mocks.validate.mockReset().mockResolvedValue([good, good]);
	mocks.settings.mockReset().mockResolvedValue({ preferredQuality: 'HIGH' });
	mocks.list.mockReset().mockResolvedValue([]);
	mocks.create.mockReset().mockResolvedValue({ id: 'local' });
	mocks.update.mockReset().mockResolvedValue(null);
	mocks.save.mockReset().mockImplementation(async (input) => ({
		id: input.expected?.id ?? 'local',
		status: input.expected ? 'synced' : 'created'
	}));
});

describe('playlist import playback boundary', () => {
	it('never pushes an unchanged playable import back over the provider source', async () => {
		mocks.list.mockResolvedValue([
			{
				id: 'local',
				tidalPlaylistId: 'remote',
				source: 'tidal',
				syncStatus: 'synced',
				items: [good]
			}
		]);
		expect(await pushAllPlaylists(ctx)).toEqual({ results: [], totalSynced: 0, totalErrors: 0 });
		expect(mocks.update).not.toHaveBeenCalled();
	});
	it('waits for playback validation before saving or reporting import success', async () => {
		let complete!: (tracks: TrackSummary[]) => void;
		mocks.validate.mockReturnValue(
			new Promise<TrackSummary[]>((resolve) => {
				complete = resolve;
			})
		);
		const pending = pullPlaylist('remote', ctx);
		await vi.waitFor(() => expect(mocks.validate).toHaveBeenCalledOnce());
		expect(mocks.save).not.toHaveBeenCalled();
		complete([good, good]);
		expect(await pending).toMatchObject({
			status: 'created',
			streamValidation: 'verified',
			tracksSkipped: 1,
			tracksReplaced: 0
		});
		expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ items: [good, good] }));
	});
	it('does not create or overwrite a playlist after an inconclusive playback check', async () => {
		mocks.validate.mockRejectedValue(new Error('temporary playback failure'));
		expect(await pullPlaylist('remote', ctx)).toMatchObject({
			status: 'error',
			streamValidation: 'deferred',
			tracksSkipped: 0
		});
		expect(mocks.save).not.toHaveBeenCalled();
		expect(mocks.update).not.toHaveBeenCalled();
	});
});

it('removes rejected entries durably when reimporting an existing local copy', async () => {
	mocks.list.mockResolvedValue([{ id: 'local', tidalPlaylistId: 'remote', items }]);
	const result = await pullPlaylist('remote', ctx);
	expect(result).toMatchObject({ status: 'synced', tracksSkipped: 1, tracksRemoved: 1 });
	expect(mocks.save).toHaveBeenCalledWith(
		expect.objectContaining({
			userId: 'owner',
			items: [good, good],
			expected: expect.objectContaining({ id: 'local' })
		})
	);
});

it.each(['local_only', 'pending_push'])(
	'protects %s playlists before any provider work',
	async (syncStatus) => {
		mocks.list.mockResolvedValue([{ id: 'local', tidalPlaylistId: 'remote', syncStatus, items }]);
		expect(await pullPlaylist('remote', ctx)).toMatchObject({
			status: 'conflict',
			errorCode: 'local_changes'
		});
		expect(mocks.fetch).not.toHaveBeenCalled();
		expect(mocks.save).not.toHaveBeenCalled();
	}
);
it('reports a commit conflict without claiming tracks were removed or replaced', async () => {
	mocks.save.mockResolvedValue({ id: 'local', status: 'conflict' });
	expect(await pullPlaylist('remote', ctx)).toMatchObject({
		status: 'conflict',
		tracksSkipped: 0,
		tracksReplaced: 0,
		errorCode: 'playlist_changed'
	});
});
it('rejects a response for the wrong source playlist', async () => {
	mocks.fetch.mockResolvedValue({ data: { id: 'another' } });
	expect(await pullPlaylist('remote', ctx)).toMatchObject({ status: 'error' });
	expect(mocks.save).not.toHaveBeenCalled();
});
it('does not save a mixed or outdated source snapshot if TIDAL changes during verification', async () => {
	mocks.fetch
		.mockResolvedValueOnce({ data: { id: 'remote', attributes: { title: 'Before' } } })
		.mockResolvedValueOnce({ data: { id: 'remote', attributes: { title: 'After' } } });
	expect(await pullPlaylist('remote', ctx)).toMatchObject({
		status: 'error',
		errorCode: 'source_changed'
	});
	expect(mocks.save).not.toHaveBeenCalled();
});
it('keeps a nonempty existing playlist if no playable source songs can be verified', async () => {
	mocks.validate.mockResolvedValue([]);
	expect(await pullPlaylist('remote', ctx)).toMatchObject({
		status: 'error',
		errorCode: 'no_playable_tracks'
	});
	expect(mocks.save).not.toHaveBeenCalled();
});
it('allows a genuinely empty source playlist after complete verification', async () => {
	mocks.normalise.mockReturnValue({ id: 'remote', title: 'Empty', items: [] });
	mocks.validate.mockResolvedValue([]);
	expect(await pullPlaylist('remote', ctx)).toMatchObject({ status: 'created', tracksSkipped: 0 });
	expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ items: [] }));
});

describe('refreshing an unchanged verified import', () => {
	const savedCopy = (remoteEtag: string, lastSyncedAt: string) => ({
		id: 'local',
		tidalPlaylistId: 'remote',
		source: 'tidal',
		syncStatus: 'synced',
		remoteEtag,
		lastSyncedAt,
		items: [good, good]
	});
	async function versionOfFirstImport(): Promise<string> {
		await pullPlaylist('remote', ctx);
		const version = mocks.save.mock.calls[0][0].sourceVersion;
		expect(version).toMatch(/^[0-9a-f]{64}$/);
		mocks.save.mockClear();
		mocks.validate.mockClear();
		mocks.fetch.mockClear();
		return version;
	}

	it('keeps a recently verified copy without probing playback again', async () => {
		const version = await versionOfFirstImport();
		mocks.list.mockResolvedValue([savedCopy(version, new Date().toISOString())]);
		expect(await pullPlaylist('remote', ctx)).toMatchObject({
			playlistId: 'local',
			status: 'synced',
			streamValidation: 'verified',
			tracksAdded: 0,
			tracksRemoved: 0
		});
		expect(mocks.fetch).toHaveBeenCalledOnce();
		expect(mocks.validate).not.toHaveBeenCalled();
		expect(mocks.save).not.toHaveBeenCalled();
	});

	it('verifies again once the copy is a week old', async () => {
		const version = await versionOfFirstImport();
		const stale = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
		mocks.list.mockResolvedValue([savedCopy(version, stale)]);
		expect(await pullPlaylist('remote', ctx)).toMatchObject({ status: 'synced' });
		expect(mocks.validate).toHaveBeenCalledOnce();
	});

	it('verifies again when the TIDAL source changed', async () => {
		mocks.list.mockResolvedValue([savedCopy('older-version', new Date().toISOString())]);
		await pullPlaylist('remote', ctx);
		expect(mocks.validate).toHaveBeenCalledOnce();
	});
});
