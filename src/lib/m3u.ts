import type { TrackSummary } from '#lib/tidal/models';

/**
 * Core Extended M3U / M3U8 builder. Pure and client-safe.
 * Translates tiddl/core/utils/m3u.py:save_tracks_to_m3u.
 *
 * `trackUrl` is the only thing that varies between callers: the browser export
 * points at `tidal.com`, the server export at the authenticated stream proxy.
 */
export interface BuildM3uOptions {
	title?: string | null;
	tracks: TrackSummary[];
	trackUrl: (track: TrackSummary) => string;
}

export function buildM3u({ title, tracks, trackUrl }: BuildM3uOptions): string {
	const lines: string[] = ['#EXTM3U'];

	if (title != null && title.trim() !== '') {
		lines.push(`#PLAYLIST:${title.trim()}`);
	}

	for (const track of tracks) {
		const duration = Math.round(track.duration ?? 0);
		const artistName = track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist';
		lines.push(`#EXTINF:${duration},${artistName} - ${track.title || 'Unknown Title'}`);
		lines.push(trackUrl(track));
	}

	return lines.join('\n') + '\n';
}

/** Public `tidal.com` link for a track — the URL used in browser-side exports. */
export function tidalTrackUrl(track: TrackSummary): string {
	return `https://tidal.com/browse/track/${encodeURIComponent(track.id)}`;
}

/**
 * Sanitizes a string for safe filesystem and export filenames.
 * Translates tiddl/core/utils/sanitize.py & format.py:_clean_segment.
 */
export function sanitizeFileName(text: string | null | undefined, fallback = 'untitled'): string {
	if (!text) return fallback;

	let cleaned = text
		// Strip control characters (U+0000–U+001F and U+007F).
		// eslint-disable-next-line no-control-regex
		.replace(/[\x00-\x1f\x7f]/g, '')
		// Replace invalid filesystem characters with underscores.
		.replace(/[\\/:*?"<>|]+/g, '_')
		// Collapse repeated underscores.
		.replace(/_{2,}/g, '_')
		// Collapse repeated dots.
		.replace(/\.{2,}/g, '.')
		// Collapse runs of whitespace into a single space.
		.replace(/\s+/g, ' ')
		.trim();

	// Remove trailing dots and spaces (forbidden on Windows / FAT / NTFS).
	cleaned = cleaned.replace(/[. ]+$/, '');

	return cleaned || fallback;
}
