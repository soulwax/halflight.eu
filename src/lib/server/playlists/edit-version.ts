import { createHash } from 'node:crypto';
import type { TrackSummary } from '#lib/tidal/models';
/** A revision for the complete editor snapshot, including duplicate occurrence metadata. */
export function playlistEditVersion(playlist: {
	title: string;
	description?: string | null;
	items: TrackSummary[];
	updatedAt: string;
}): string {
	return createHash('sha256')
		.update(
			JSON.stringify({
				title: playlist.title,
				description: playlist.description ?? null,
				items: playlist.items,
				updatedAt: playlist.updatedAt
			})
		)
		.digest('hex');
}
