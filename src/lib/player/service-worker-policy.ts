/**
 * Service Worker routing and cache policy for Halflight / Syn.
 * Strict rules adhering to MASTERPLAN.md (lines 1204-1214):
 * - Audio streams and Range requests explicitly bypass the worker.
 * - Authenticated HTML and SvelteKit data requests are network-only.
 * - Public app shell and neutral /offline page are precached.
 * - Sign-in, verification, OAuth, and mutations are never cached or replayed.
 */

export const PRECACHE_BUDGET_BYTES = 2 * 1024 * 1024; // 2 MiB budget
export const OFFLINE_FALLBACK_URL = '/offline';

/**
 * Determines if an incoming HTTP request must bypass the service worker entirely.
 * Bypassed requests fall through to the native network stack without caching.
 */
export function shouldBypassServiceWorker(url: URL, request: Request): boolean {
	// Non-GET requests (mutations, session flushes, telemetry) must never be intercepted
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return true;
	}

	// Byte range requests (e.g. audio streaming) must bypass service worker cache routing
	if (request.headers.has('range')) {
		return true;
	}

	const pathname = url.pathname;

	// Explicit bypass: Audio streams, manifests, and media proxy routes
	if (
		pathname.startsWith('/api/tracks/') &&
		(pathname.endsWith('/audio') || pathname.endsWith('/stream'))
	) {
		return true;
	}

	// Explicit bypass: Provider OAuth, credentials, and token-handling endpoints
	if (
		pathname.startsWith('/tidal/') ||
		pathname.startsWith('/api/tidal/') ||
		pathname.startsWith('/lastfm/') ||
		pathname.startsWith('/sign-in') ||
		pathname.startsWith('/logout') ||
		pathname.startsWith('/debug/')
	) {
		return true;
	}

	// Explicit bypass: Owned state and sync endpoints (network-only)
	if (
		pathname.startsWith('/api/playback-state') ||
		pathname.startsWith('/api/favorites') ||
		pathname.startsWith('/api/playlists') ||
		pathname.startsWith('/api/private-music') ||
		pathname.startsWith('/api/taste') ||
		pathname.startsWith('/api/generation-cooldown')
	) {
		return true;
	}

	return false;
}

/**
 * Validates whether a file path qualifies for precaching in the revisioned app-shell cache.
 * Restricts assets to approved public build chunks, owned icons/fonts, and the neutral offline route.
 */
export function isPrecacheCandidate(pathname: string): boolean {
	// Neutral offline fallback route
	if (pathname === OFFLINE_FALLBACK_URL || pathname === `${OFFLINE_FALLBACK_URL}/`) {
		return true;
	}

	// Manifest
	if (pathname === '/manifest.webmanifest') {
		return true;
	}

	// Owned raster icons and favicon
	if (pathname.startsWith('/icons/') || pathname === '/favicon.png') {
		return true;
	}

	// Immutable content-hashed SvelteKit client bundles and CSS
	if (pathname.startsWith('/_app/immutable/')) {
		// Exclude prerendered private data payloads
		if (pathname.endsWith('.json') && pathname.includes('__data')) {
			return false;
		}
		return true;
	}

	return false;
}

/**
 * Identifies full-page HTML navigation requests that qualify for the /offline fallback.
 */
export function isNavigationRequest(request: Request): boolean {
	return (
		request.mode === 'navigate' ||
		request.destination === 'document' ||
		Boolean(request.headers.get('accept')?.includes('text/html'))
	);
}
