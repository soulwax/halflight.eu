import type { TrackSummary } from '#lib/tidal/models';
import { buildM3u, tidalTrackUrl } from '#lib/m3u';

/**
 * Extended M3U8 playlist content for a browser-side download, linking each track
 * to its public `tidal.com` page.
 */
export function generateM3u8(title: string, tracks: TrackSummary[]): string {
	return buildM3u({ title, tracks, trackUrl: tidalTrackUrl });
}

/**
 * Triggers a client-side file download of M3U8 playlist content in the browser.
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
