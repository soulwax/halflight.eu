import { getTrack } from '#lib/server/tidal/api';
import { normalisePlaylistDetail, normaliseTrackDetail } from '#lib/server/tidal/normalise';
import type { TidalRequestContext } from '#lib/server/tidal/client';
import type { Document, Resource } from '#lib/server/tidal/jsonapi';
import type { PlaylistDetail, TrackSummary } from '#lib/tidal/models';
import { TidalApiError } from '#lib/server/tidal/errors';

/** Resolve metadata by recording ID, never by title or result position. */
export async function resolveImportMetadata(
	document: Document<Resource>,
	ctx: TidalRequestContext,
	readTrack = getTrack,
	preferred: Map<string, TrackSummary> = new Map()
): Promise<PlaylistDetail> {
	const playlist = normalisePlaylistDetail(document);
	if (!playlist) throw new Error('Invalid playlist metadata');
	const relationship = document.data.relationships?.items ?? document.data.relationships?.tracks;
	const linkages = relationship?.data;
	const ordered = (Array.isArray(linkages) ? linkages : linkages ? [linkages] : []).filter(
		(item) => item.type === 'tracks'
	);
	if (!relationship) throw new Error('Playlist order is missing');
	const count = document.data.attributes?.numberOfItems ?? document.data.attributes?.numberOfTracks;
	if (
		typeof count === 'number' &&
		count !== (Array.isArray(linkages) ? linkages.length : linkages ? 1 : 0)
	)
		throw new Error('Playlist metadata is incomplete');
	if (ordered.length !== (Array.isArray(linkages) ? linkages.length : linkages ? 1 : 0))
		throw new Error('Playlist contains unsupported items');
	if (ordered.some((item) => !/^\d+$/.test(item.id))) throw new Error('Invalid recording ID');

	const ids = [...new Set(ordered.map((item) => item.id))];
	const resolved = new Map<string, TrackSummary>();
	const sourceTracks = new Map(playlist.items.map((track) => [track.id, track]));
	// Bounded concurrency, no per-recording cache: reimport must repair stale metadata.
	for (let offset = 0; offset < ids.length; offset += 3) {
		ctx.signal?.throwIfAborted();
		const batch = await Promise.all(
			ids.slice(offset, offset + 3).map(async (id) => {
				const included = sourceTracks.get(id);
				// Complete, ID-indexed compound metadata is already authoritative for this snapshot.
				// Fetch individually only when the provider left holes; checking every ID again
				// causes a burst of redundant catalogue calls before playback verification starts.
				// Artwork is not required: neither the playlist nor the track read side-loads it.
				if (included?.title.trim() && included.artists.length && included.album?.id)
					return included;
				let detail;
				try {
					detail = normaliseTrackDetail(
						await readTrack(id, { include: ['artists', 'albums'] }, ctx)
					);
				} catch (cause) {
					// Retired catalogue entries still belong to the source snapshot. The
					// following playback validation excludes them from the playable view.
					if (!(cause instanceof TidalApiError) || cause.status !== 404) throw cause;
					const chosen = preferred.get(id);
					detail =
						sourceTracks.get(id) ??
						(chosen ? { ...chosen, id, isrc: undefined, replacementForId: undefined } : null);
				}
				if (!detail || detail.id !== id) throw new Error('Recording metadata did not match its ID');
				const source = sourceTracks.get(id);
				return {
					...detail,
					artists: detail.artists.length ? detail.artists : (source?.artists ?? []),
					album: detail.album ?? source?.album,
					imageUrl: detail.imageUrl ?? source?.imageUrl,
					kind: 'track' as const
				};
			})
		);
		for (const track of batch) resolved.set(track.id, track);
	}
	const items = ordered.map(({ id }) => resolved.get(id)!);
	if (items.length !== ordered.length) throw new Error('Playlist metadata is incomplete');
	return { ...playlist, items, numberOfItems: items.length };
}
