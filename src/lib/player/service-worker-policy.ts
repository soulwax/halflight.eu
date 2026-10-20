/**
 * Service Worker routing and cache policy for Halflight / Syn.
 * Strict rules adhering to MASTERPLAN.md (lines 1204-1214):
 * - Audio streams and Range requests explicitly bypass the worker.
 * - Authenticated HTML and SvelteKit data requests are network-only.
 * - The neutral /offline page, its CSS, manifest, and install icons are precached.
 * - Sign-in, verification, OAuth, and mutations are never cached or replayed.
 */

export const OFFLINE_FALLBACK_URL = '/offline';
export const OFFLINE_FALLBACK_URLS = [OFFLINE_FALLBACK_URL, '/de-de/offline'] as const;

// Only cache the icons declared for Halflight Now and the browser tab icon.
// `static/icons` also contains theme artwork and source variants that are not
// install assets and would waste the deliberately small app-shell budget.
const PRECACHE_ICON_PATHS = new Set([
	'/icons/halflight-32.png',
	'/icons/halflight-180.png',
	'/icons/halflight-192.png',
	'/icons/halflight-512.png',
	'/icons/halflight-maskable-512.png'
]);

// These are the stylesheets linked by the root layout and the offline page.
// Keep route-specific client styles out of the recovery-shell cache.
const PRECACHE_STYLESHEET_PREFIXES = [
	'/_app/immutable/assets/0.',
	'/_app/immutable/assets/AppHeader.',
	'/_app/immutable/assets/Dialog.',
	'/_app/immutable/assets/Notice.',
	'/_app/immutable/assets/OfflineRecovery.',
	'/_app/immutable/assets/SearchField.'
];

/** SvelteKit's manifest contains relative path records, not URL strings. */
export function buildPrecacheAssets(entries: ReadonlyArray<{ path: string }>): string[] {
	const paths = entries.map(({ path }) => (path.startsWith('/') ? path : `/${path}`));
	return [...new Set([...paths.filter(isPrecacheCandidate), ...OFFLINE_FALLBACK_URLS])];
}

/** Keep the neutral recovery copy in the language selected by the route URL. */
export function offlineFallbackUrlFor(url: URL): (typeof OFFLINE_FALLBACK_URLS)[number] {
	return url.pathname === '/de-de' || url.pathname.startsWith('/de-de/')
		? '/de-de/offline'
		: OFFLINE_FALLBACK_URL;
}

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
 * Validates whether a file path qualifies for precaching in the revisioned recovery-shell cache.
 * Restricts persistent content to the neutral offline pages, their CSS, manifest, and owned icons.
 */
export function isPrecacheCandidate(pathname: string): boolean {
	// Neutral offline fallback route
	if (
		OFFLINE_FALLBACK_URLS.some((fallback) => pathname === fallback || pathname === `${fallback}/`)
	) {
		return true;
	}

	// Manifest
	if (pathname === '/manifest.webmanifest') {
		return true;
	}

	// Owned raster icons and favicon
	if (PRECACHE_ICON_PATHS.has(pathname) || pathname === '/favicon.png') {
		return true;
	}

	// Cache the CSS needed to display the server-rendered offline page. Do not
	// cache route JS: the offline shell has no client runtime and no offline app.
	if (pathname.endsWith('.css')) {
		return PRECACHE_STYLESHEET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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
