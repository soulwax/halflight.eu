import type { TrackSummary } from './models';

export type ArtworkSize = 80 | 160 | 320 | 640;

/** Resize only known artwork endpoints; leave arbitrary display URLs intact. */
export function artworkUrlForSize(url: string, size: ArtworkSize): string {
	const local = url.match(/^(\/api\/(?:tracks|albums)\/\d+\/artwork)(?:\?size=\d+)?$/);
	if (local) return `${local[1]}${size === 640 ? '' : `?size=${size}`}`;
	return url.replace(
		/^(https:\/\/resources\.tidal\.com\/images\/[a-f\d/]+\/)\d+x\d+(\.jpg)$/i,
		`$1${size}x${size}$2`
	);
}

/**
 * A track's canonical artwork. Its own `imageUrl` is used verbatim once set;
 * otherwise the album's image, then the album proxy, then the track proxy (an
 * image resolves its own missing artwork without a preceding JSON request).
 *
 * The player writes this canonical URL into `imageUrl` as a track enters
 * playback and nothing re-addresses it afterwards. A URL that changed as album
 * data arrived reloaded the same cover and re-faded the full-screen player.
 * Catalogue image URLs keep precedence because the proxies need the listener's
 * playback token and those URLs do not.
 */
export function trackArtworkUrl(
	track: Pick<TrackSummary, 'id' | 'imageUrl' | 'album'> | null | undefined,
	size: ArtworkSize = 640
): string | null {
	if (!track) return null;
	const supplied = track.imageUrl ?? track.album?.imageUrl;
	if (supplied) return artworkUrlForSize(supplied, size);
	if (!/^\d+$/.test(track.id)) return null;
	if (track.album && /^\d+$/.test(track.album.id))
		return artworkUrlForSize(`/api/albums/${track.album.id}/artwork`, size);
	return artworkUrlForSize(`/api/tracks/${track.id}/artwork`, size);
}
