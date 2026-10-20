/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { assets, immutable } from '$app/manifest';
import { version } from '$app/env';
import {
	isNavigationRequest,
	buildPrecacheAssets,
	offlineFallbackUrlFor,
	shouldBypassServiceWorker
} from '#lib/player/service-worker-policy.js';

declare const self: ServiceWorkerGlobalScope;

const CACHE = `syn-cache-v${version}`;

// Filter public client assets and the neutral offline page within the precache budget
const ASSETS = buildPrecacheAssets([...immutable, ...assets]);

async function askWindowsIfUpdateIsSafe(): Promise<Array<{ client: WindowClient; safe: boolean }>> {
	const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
	return Promise.all(
		windows.map(
			(client) =>
				new Promise<{ client: WindowClient; safe: boolean }>((resolve) => {
					const channel = new MessageChannel();
					const timeout = setTimeout(() => {
						channel.port1.close();
						resolve({ client, safe: false });
					}, 2000);
					channel.port1.onmessage = (reply) => {
						clearTimeout(timeout);
						channel.port1.close();
						resolve({ client, safe: reply.data?.safe === true });
					};
					try {
						client.postMessage({ type: 'PWA_PREPARE_UPDATE' }, [channel.port2]);
					} catch {
						clearTimeout(timeout);
						channel.port1.close();
						resolve({ client, safe: false });
					}
				})
		)
	);
}

self.addEventListener('install', (event) => {
	// Precache public assets and offline fallback.
	// As specified in MASTERPLAN.md, we do not call skipWaiting() automatically
	// to avoid interrupting active playback in open tabs.
	event.waitUntil(
		(async () => {
			// `addAll` rejects when any required shell asset is unavailable. Preserve
			// an existing cache: a failed update can share this cache name with the
			// currently active worker, which still needs its complete offline shell.
			const cacheAlreadyExists = (await caches.keys()).includes(CACHE);
			try {
				await (await caches.open(CACHE)).addAll(ASSETS);
			} catch (error) {
				if (!cacheAlreadyExists) await caches.delete(CACHE);
				throw error;
			}
		})()
	);
});

self.addEventListener('activate', (event) => {
	// Prune stale syn caches while preserving unrelated worker caches
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE && key.startsWith('syn-cache-')) {
					await caches.delete(key);
				}
			}
		})
	);
});

// The page only sends this after the owner chooses to apply a waiting update.
// Never activate a new worker merely because it was downloaded.
self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') {
		event.waitUntil(
			(async () => {
				const results = await askWindowsIfUpdateIsSafe();
				if (results.length === 0 || results.some((result) => !result.safe)) {
					for (const { client } of results) {
						try {
							client.postMessage({ type: 'PWA_UPDATE_CANCELLED' });
						} catch {
							// A window may close after its readiness reply.
						}
					}
					event.source?.postMessage({ type: 'PWA_UPDATE_DEFERRED' });
					return;
				}
				try {
					await self.skipWaiting();
				} catch {
					for (const { client } of results) {
						try {
							client.postMessage({ type: 'PWA_UPDATE_CANCELLED' });
						} catch {
							// A window may close after its readiness reply.
						}
					}
					event.source?.postMessage({ type: 'PWA_UPDATE_DEFERRED' });
				}
			})()
		);
		return;
	}
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Only handle same-origin requests
	if (url.origin !== location.origin) return;

	// Respect strict bypass rules: audio streams, Range 206 requests,
	// OAuth/credentials, and dynamic playback state are never intercepted.
	if (shouldBypassServiceWorker(url, event.request)) return;

	// Cache-first for revisioned static assets
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(
			caches.open(CACHE).then(async (cache) => {
				const cached = await cache.match(event.request);
				if (cached) return cached;
				const response = await fetch(event.request);
				if (response.ok) {
					void cache.put(event.request, response.clone());
				}
				return response;
			})
		);
		return;
	}

	// HTML navigation requests: Network-first, fallback to /offline when disconnected.
	if (isNavigationRequest(event.request)) {
		event.respondWith(
			fetch(event.request).catch(async () => {
				const fallbackUrl = new URL(offlineFallbackUrlFor(url), self.location.origin);
				let offlineFallback = await (await caches.open(CACHE)).match(fallbackUrl.href);
				// A navigation can still be controlled by the previous worker while a new
				// worker activates and prunes its cache. Check the current shell cache too.
				if (!offlineFallback) {
					const cacheNames = await caches.keys();
					for (const cacheName of cacheNames) {
						if (!cacheName.startsWith('syn-cache-') || cacheName === CACHE) continue;
						offlineFallback = await (await caches.open(cacheName)).match(fallbackUrl.href);
						if (offlineFallback) break;
					}
				}
				if (offlineFallback) return offlineFallback;
				return new Response('Network unavailable', {
					status: 503,
					headers: { 'Content-Type': 'text/plain' }
				});
			})
		);
	}
});
