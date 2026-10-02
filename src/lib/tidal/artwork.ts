import type { TrackSummary } from './models';

export type ArtworkSize = 80 | 160 | 320 | 640;

/** Resize only known artwork endpoints; leave arbitrary display URLs intact. */
export function artworkUrlForSize(url: string, size: ArtworkSize): string {
	const local = url.match(/^(\/api\/tracks\/\d+\/artwork)(?:\?size=\d+)?$/);
	if (local) return `${local[1]}${size === 640 ? '' : `?size=${size}`}`;
	return url.replace(
		/^(https:\/\/resources\.tidal\.com\/images\/[a-f\d/]+\/)\d+x\d+(\.jpg)$/i,
		`$1${size}x${size}$2`
	);
}

/** An image can resolve its own missing artwork, without a preceding JSON request. */
export function trackArtworkUrl(
	track: Pick<TrackSummary, 'id' | 'imageUrl' | 'album'> | null | undefined,
	size: ArtworkSize = 640
): string | null {
	if (!track) return null;
	const supplied = track.imageUrl ?? track.album?.imageUrl;
	if (supplied) return artworkUrlForSize(supplied, size);
	return /^\d+$/.test(track.id) ? artworkUrlForSize(`/api/tracks/${track.id}/artwork`, size) : null;
}
