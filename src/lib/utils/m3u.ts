import type { TrackSummary } from '#lib/server/tidal/models';

/**
 * Generates standard Extended M3U8 playlist content from a list of tracks.
 * Translates tiddl/core/utils/m3u.py:save_tracks_to_m3u.
 */
export function generateM3u8(title: string, tracks: TrackSummary[]): string {
	const lines: string[] = ['#EXTM3U', `#PLAYLIST:${title.trim()}`];

	for (const track of tracks) {
		const duration = Math.round(track.duration || 0);
		const artistName = track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist';
		const trackTitle = track.title || 'Unknown Title';

		lines.push(`#EXTINF:${duration},${artistName} - ${trackTitle}`);
		lines.push(`https://tidal.com/browse/track/${encodeURIComponent(track.id)}`);
	}

	return lines.join('\n') + '\n';
}

/**
 * Initiates client-side file download of M3U8 playlist content in the browser.
 */
export function downloadM3u8File(filename: string, content: string): void {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;

	const cleanFilename =
		filename.endsWith('.m3u8') || filename.endsWith('.m3u') ? filename : `${filename}.m3u8`;

	const blob = new Blob([content], { type: 'application/x-mpegURL;charset=utf-8' });
	const url = URL.createObjectURL(blob);

	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = cleanFilename;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);

	setTimeout(() => {
		URL.revokeObjectURL(url);
	}, 1000);
}
