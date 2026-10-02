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
	update: vi.fn()
}));
vi.mock('#lib/server/tidal/api', async (importOriginal) => ({
	...(await importOriginal<object>()),
	getFullPlaylist: mocks.fetch
}));
vi.mock('#lib/server/tidal/normalise', () => ({ normalisePlaylistDetail: mocks.normalise }));
vi.mock('./playback-validation', () => ({ validatePlaylistPlayback: mocks.validate }));
vi.mock('#lib/server/streaming-settings', () => ({ getStreamingSettings: mocks.settings }));
vi.mock('./index', () => ({
	getUserPlaylists: mocks.list,
	createUserPlaylist: mocks.create,
	updateUserPlaylist: mocks.update
}));
import { pullPlaylist } from './sync';

const good: TrackSummary = { kind: 'track', id: '1', title: 'Playable', artists: [] };
const bad: TrackSummary = { kind: 'track', id: '2', title: 'Defective', artists: [] };
const items = [good, bad, good];
const ctx = { userId: 'owner', fetch, cookies: {} as Cookies };

beforeEach(() => {
	mocks.fetch.mockReset().mockResolvedValue({});
	mocks.normalise.mockReset().mockReturnValue({ id: 'remote', title: 'Playlist', items });
	mocks.validate.mockReset().mockResolvedValue([good, good]);
	mocks.settings.mockReset().mockResolvedValue({ preferredQuality: 'HIGH' });
	mocks.list.mockReset().mockResolvedValue([]);
	mocks.create.mockReset().mockResolvedValue({ id: 'local' });
	mocks.update.mockReset().mockResolvedValue(null);
});

describe('playlist import playback boundary', () => {
	it('waits for playback validation before saving or reporting import success', async () => {
		let complete!: (tracks: TrackSummary[]) => void;
		mocks.validate.mockReturnValue(
			new Promise<TrackSummary[]>((resolve) => {
				complete = resolve;
			})
		);
		const pending = pullPlaylist('remote', ctx);
		await vi.waitFor(() => expect(mocks.validate).toHaveBeenCalledOnce());
		expect(mocks.create).not.toHaveBeenCalled();
		complete([good, good]);
		expect(await pending).toMatchObject({
			status: 'created',
			streamValidation: 'verified',
			tracksSkipped: 1,
			tracksReplaced: 0
		});
		expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ items }));
	});
	it('does not create or overwrite a playlist after an inconclusive playback check', async () => {
		mocks.validate.mockRejectedValue(new Error('temporary playback failure'));
		expect(await pullPlaylist('remote', ctx)).toMatchObject({
			status: 'error',
			streamValidation: 'deferred',
			tracksSkipped: 0
		});
		expect(mocks.create).not.toHaveBeenCalled();
		expect(mocks.update).not.toHaveBeenCalled();
	});
});
