/** Safe storage summaries; credentials and object identities stay on the server. */
export type StoredSummary<T> = { status: 'ready'; data: T } | { status: 'unavailable' };

export interface StorageOverview {
	privateMusic: StoredSummary<{ fileCount: number; usedBytes: number; maxTotalBytes: number }>;
	privateMusicEnabled: boolean;
	exportsEnabled: boolean;
	audioCacheEnabled: boolean;
	playback: StoredSummary<{ queueCount: number; historyCount: number; revision: number }>;
	playlists: StoredSummary<{ count: number }>;
	preferences: StoredSummary<{ streamingSaved: boolean; appearanceSaved: boolean }>;
}
