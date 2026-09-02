import type { TrackSummary } from './models';

/**
 * Sanitizes a string for safe filesystem and export filenames.
 * Translates tiddl/core/utils/sanitize.py & format.py:_clean_segment.
 */
export function sanitizeFileName(text: string | null | undefined, fallback = 'untitled'): string {
	if (!text) return fallback;

	let cleaned = text
		// Strip control characters (U+0000–U+001F and U+007F) — eslint-disable-next-line no-control-regex
		// eslint-disable-next-line no-control-regex
		.replace(/[\x00-\x1f\x7f]/g, '')
		// Replace invalid filesystem characters with underscores
		.replace(/[\\/:*?"<>|]+/g, '_')
		// Collapse multiple underscores
		.replace(/_{2,}/g, '_')
		// Collapse multiple dots
		.replace(/\.{2,}/g, '.')
		// Collapse multiple whitespace characters into one space
		.replace(/\s+/g, ' ')
		.trim();

	// Remove trailing dots and spaces (forbidden on Windows / FAT / NTFS)
	cleaned = cleaned.replace(/[. ]+$/, '');

	return cleaned || fallback;
}

export interface GenerateM3uOptions {
	title?: string;
	tracks: TrackSummary[];
	baseUrl?: string;
}

/**
 * Generates standard extended M3U / M3U8 playlist content from a list of tracks.
 * Translates tiddl/core/utils/m3u.py:save_tracks_to_m3u.
 */
export function generateM3u({ title, tracks, baseUrl }: GenerateM3uOptions): string {
	const lines: string[] = ['#EXTM3U'];

	if (title) {
		lines.push(`#PLAYLIST:${title}`);
	}

	for (const track of tracks) {
		const duration = Math.round(track.duration || 0);
		const artistName = track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist';
		const trackTitle = track.title || 'Untitled Track';

		lines.push(`#EXTINF:${duration},${artistName} - ${trackTitle}`);

		if (baseUrl) {
			const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
			lines.push(`${cleanBase}/api/tracks/${track.id}/stream`);
		} else {
			lines.push(`https://listen.tidal.com/track/${track.id}`);
		}
	}

	return lines.join('\n') + '\n';
}
