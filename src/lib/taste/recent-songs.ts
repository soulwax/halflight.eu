export interface RecentSong {
	artist: string;
	title: string;
	recordingId?: string;
	playedAt: number;
}
export interface WeightedRecentSong extends RecentSong {
	repeats: number;
	weight: number;
}
function normalize(value: string): string {
	return value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}
/** Each recording appears once; repeats add bounded interest rather than extra rows. */
export function weightedRecentSongs(
	observations: RecentSong[],
	now = Date.now()
): WeightedRecentSong[] {
	const songs = new Map<string, WeightedRecentSong>();
	for (const song of observations) {
		if (
			!song.artist.trim() ||
			!song.title.trim() ||
			!Number.isFinite(song.playedAt) ||
			song.playedAt <= 0 ||
			song.playedAt > now + 60_000
		)
			continue;
		const key =
			song.recordingId?.trim() || JSON.stringify([normalize(song.artist), normalize(song.title)]);
		const previous = songs.get(key);
		const latest = previous && previous.playedAt > song.playedAt ? previous : song;
		songs.set(key, { ...latest, repeats: (previous?.repeats ?? 0) + 1, weight: 0 });
	}
	return [...songs.values()]
		.map((song) => ({
			...song,
			weight:
				Math.min(2, 1 + 0.25 * Math.log2(song.repeats)) *
				2 ** (-Math.max(0, now - song.playedAt) / (90 * 86_400_000))
		}))
		.sort((a, b) => b.playedAt - a.playedAt);
}
