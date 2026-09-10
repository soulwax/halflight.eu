/**
 * Shared HTTP conditional-request helpers.
 *
 * Lifted out of `/api/private-music/[id]`, which already implemented all of this
 * correctly, so the TIDAL audio proxy can reuse it rather than growing a second,
 * subtly different copy. Byte-range parsing lives in
 * `#lib/server/tidal/segmented` (`parseByteRange`), which both routes already
 * share.
 */

/**
 * Build a strong entity tag from the parts that identify a representation.
 *
 * Pass everything that changes the bytes. For TIDAL audio that is the track id
 * *and the delivered quality* — the URL does not encode quality, so without it a
 * preference change would be served stale bytes out of the browser cache.
 */
export function entityTag(...parts: (string | number)[]): string {
	return `"${parts.join('-')}"`;
}

/** Does an `If-None-Match` / `If-Range` header list `tag` (or `*`)? */
export function matchesEntityTag(header: string | null, tag: string): boolean {
	return Boolean(
		header
			?.split(',')
			.map((value) => value.trim())
			.some((value) => value === '*' || value === tag)
	);
}

/**
 * A `Range` request may only be honoured when the client either sent no
 * `If-Range` or sent one naming the representation we are about to serve.
 * Otherwise it is holding a stale partial and must be given the whole body.
 */
export function rangeIsUsable(request: Request, tag: string): boolean {
	if (!request.headers.get('range')) return false;
	const ifRange = request.headers.get('if-range');
	return !ifRange || matchesEntityTag(ifRange, tag);
}
