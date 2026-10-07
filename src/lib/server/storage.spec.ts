import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	list: vi.fn(),
	playback: vi.fn(),
	playlists: vi.fn(),
	streaming: vi.fn(),
	appearance: vi.fn()
}));
vi.mock('./private-music', () => ({
	dbPrivateMusicStore: { list: mocks.list },
	MAX_PRIVATE_MUSIC_TOTAL_BYTES: 512 * 1024 ** 2
}));
vi.mock('./private-music-bucket', () => ({ privateMusicBucket: { enabled: true } }));
vi.mock('./export-bucket', () => ({ exportBucket: { enabled: false } }));
vi.mock('./tidal/segment-cache-bucket', () => ({ tidalSegmentCache: { enabled: false } }));
vi.mock('./playback-state', () => ({ dbPlaybackStateStore: { read: mocks.playback } }));
vi.mock('./playlists', () => ({ getUserPlaylists: mocks.playlists }));
vi.mock('./streaming-settings', () => ({ dbStreamingSettingsStore: { read: mocks.streaming } }));
vi.mock('./theme-settings', () => ({ dbThemeSettingsStore: { read: mocks.appearance } }));

import { getStorageOverview } from './storage';

describe('storage overview', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.list.mockResolvedValue([{ sizeBytes: 100, objectKey: 'secret-key' }, { sizeBytes: 250 }]);
		mocks.playback.mockResolvedValue({ queue: [{}], history: [{}, {}], revision: 7 });
		mocks.playlists.mockResolvedValue([{}]);
		mocks.streaming.mockResolvedValue(null);
		mocks.appearance.mockResolvedValue({ theme: 'warm-night' });
	});

	it('reads only the signed-in account and returns safe summaries', async () => {
		const result = await getStorageOverview('listener');
		for (const read of Object.values(mocks)) expect(read).toHaveBeenCalledWith('listener');
		expect(result.privateMusic).toEqual({
			status: 'ready',
			data: { fileCount: 2, usedBytes: 350, maxTotalBytes: 512 * 1024 ** 2 }
		});
		expect(result.playback).toEqual({
			status: 'ready',
			data: { queueCount: 1, historyCount: 2, revision: 7 }
		});
		expect(result.preferences).toEqual({
			status: 'ready',
			data: { streamingSaved: false, appearanceSaved: true }
		});
		expect(JSON.stringify(result)).not.toContain('secret-key');
		expect(result.exportsEnabled).toBe(false);
	});

	it('isolates failures rather than reporting empty storage', async () => {
		mocks.list.mockRejectedValue(new Error('Database offline'));
		mocks.streaming.mockRejectedValue(new Error('Database offline'));
		const result = await getStorageOverview('listener');
		expect(result.privateMusic).toEqual({ status: 'unavailable' });
		expect(result.preferences).toEqual({ status: 'unavailable' });
		expect(result.playback.status).toBe('ready');
		expect(result.playlists.status).toBe('ready');
	});

	it('treats an account without a saved session as an empty session', async () => {
		mocks.playback.mockResolvedValue(null);
		expect((await getStorageOverview('new-listener')).playback).toEqual({
			status: 'ready',
			data: { queueCount: 0, historyCount: 0, revision: 0 }
		});
	});
});
