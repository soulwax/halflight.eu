import type { TrackSummary } from './models';
/** Use four distinct albums in playlist order, or the first album as a single cover. */
export function playlistCoverTracks(tracks: readonly TrackSummary[]): TrackSummary[] {
	const albums: TrackSummary[] = [];
	const seen = new Set<string>();
	for (const track of tracks) {
		if (!track.album) continue;
		const key =
			track.album.id ||
			`${track.album.title}:${track.artists.map((artist) => artist.name).join(',')}`;
		if (seen.has(key)) continue;
		seen.add(key);
		albums.push(track);
		if (albums.length === 4) return albums;
	}
	return albums.length ? [albums[0]] : tracks.length ? [tracks[0]] : [];
}
