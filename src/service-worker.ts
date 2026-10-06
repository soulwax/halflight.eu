/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { assets, immutable } from '$app/manifest';
import { version } from '$app/env';
import {
	isNavigationRequest,
	buildPrecacheAssets,
	OFFLINE_FALLBACK_URL,
	shouldBypassServiceWorker
} from '#lib/player/service-worker-policy.js';

declare const self: ServiceWorkerGlobalScope;

const CACHE = `syn-cache-v${version}`;

// Filter public client assets and the neutral offline page within the precache budget
const ASSETS = buildPrecacheAssets([...immutable, ...assets]);

self.addEventListener('install', (event) => {
	// Precache public assets and offline fallback.
	// As specified in MASTERPLAN.md, we do not call skipWaiting() automatically
	// to avoid interrupting active playback in open tabs.
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.catch(() => {
				// Best-effort precache installation
			})
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
				const cache = await caches.open(CACHE);
				const offlineFallback = await cache.match(OFFLINE_FALLBACK_URL);
				if (offlineFallback) return offlineFallback;
				return new Response('Network unavailable', {
					status: 503,
					headers: { 'Content-Type': 'text/plain' }
				});
			})
		);
	}
});
