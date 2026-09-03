import type { TrackSummary } from '#lib/tidal/models';
import { buildM3u } from '#lib/m3u';

export { sanitizeFileName } from '#lib/m3u';

export interface GenerateM3uOptions {
	title?: string;
	tracks: TrackSummary[];
	baseUrl?: string;
}

/**
 * Extended M3U for a server-side export. With `baseUrl` each entry points at the
 * authenticated stream proxy; without it, at the public `listen.tidal.com` page.
 */
export function generateM3u({ title, tracks, baseUrl }: GenerateM3uOptions): string {
	const cleanBase = baseUrl?.replace(/\/$/, '');
	return buildM3u({
		title,
		tracks,
		trackUrl: (track) =>
			cleanBase
				? `${cleanBase}/api/tracks/${track.id}/stream`
				: `https://listen.tidal.com/track/${track.id}`
	});
}
