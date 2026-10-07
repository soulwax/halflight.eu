import type { StorageOverview, StoredSummary } from '#lib/storage';
import { dbPrivateMusicStore, MAX_PRIVATE_MUSIC_TOTAL_BYTES } from './private-music';
import { privateMusicBucket } from './private-music-bucket';
import { exportBucket } from './export-bucket';
import { tidalSegmentCache } from './tidal/segment-cache-bucket';
import { dbPlaybackStateStore } from './playback-state';
import { getUserPlaylists } from './playlists';
import { dbStreamingSettingsStore } from './streaming-settings';
import { dbThemeSettingsStore } from './theme-settings';

export const storageSources = {
	privateMusic: dbPrivateMusicStore,
	privateMusicBucket,
	exportBucket,
	audioCache: tidalSegmentCache,
	playback: dbPlaybackStateStore,
	playlists: getUserPlaylists,
	streaming: dbStreamingSettingsStore,
	appearance: dbThemeSettingsStore
};

async function summarize<T>(read: () => Promise<T>): Promise<StoredSummary<T>> {
	try {
		return { status: 'ready', data: await read() };
	} catch {
		return { status: 'unavailable' };
	}
}

/** Independent reads let a failed store leave the other mobile controls usable. */
export async function getStorageOverview(
	userId: string,
	sources = storageSources
): Promise<StorageOverview> {
	const [privateMusic, playback, playlists, preferences] = await Promise.all([
		summarize(async () => {
			const files = await sources.privateMusic.list(userId);
			return {
				fileCount: files.length,
				usedBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
				maxTotalBytes: MAX_PRIVATE_MUSIC_TOTAL_BYTES
			};
		}),
		summarize(async () => {
			const state = await sources.playback.read(userId);
			return {
				queueCount: state?.queue.length ?? 0,
				historyCount: state?.history.length ?? 0,
				revision: state?.revision ?? 0
			};
		}),
		summarize(async () => ({ count: (await sources.playlists(userId)).length })),
		summarize(async () => {
			const [streaming, appearance] = await Promise.all([
				sources.streaming.read(userId),
				sources.appearance.read(userId)
			]);
			return { streamingSaved: streaming !== null, appearanceSaved: appearance !== null };
		})
	]);
	return {
		privateMusic,
		playback,
		playlists,
		preferences,
		privateMusicEnabled: sources.privateMusicBucket.enabled,
		exportsEnabled: sources.exportBucket.enabled,
		audioCacheEnabled: sources.audioCache.enabled
	};
}
