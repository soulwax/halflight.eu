import { describe, expect, it } from 'vitest';
import {
	buildPrecacheAssets,
	isNavigationRequest,
	isPrecacheCandidate,
	shouldBypassServiceWorker
} from './service-worker-policy.js';

describe('service-worker-policy.ts', () => {
	it('normalizes actual manifest records before applying the public cache allowlist', () => {
		expect(
			buildPrecacheAssets([
				{ path: '_app/immutable/entry/app.hash.js' },
				{ path: '_app/immutable/assets/layout.hash.css' },
				{ path: 'icons/halflight-192.png' },
				{ path: '/icons/halflight-192.png' },
				{ path: 'manifest.webmanifest' },
				{ path: '_app/immutable/__data.json' },
				{ path: 'api/tracks/123/audio' },
				{ path: 'home' },
				{ path: 'sign-in' }
			])
		).toEqual([
			'/_app/immutable/entry/app.hash.js',
			'/_app/immutable/assets/layout.hash.css',
			'/icons/halflight-192.png',
			'/manifest.webmanifest',
			'/offline'
		]);
	});
	it('bypasses audio streams and manifests', () => {
		const audioUrl = new URL('https://m.halflight.eu/api/tracks/track-123/audio');
		const streamUrl = new URL('https://m.halflight.eu/api/tracks/track-123/stream');
		const req = new Request(audioUrl, { method: 'GET' });

		expect(shouldBypassServiceWorker(audioUrl, req)).toBe(true);
		expect(shouldBypassServiceWorker(streamUrl, new Request(streamUrl))).toBe(true);
	});

	it('bypasses requests containing Range headers', () => {
		const url = new URL('https://m.halflight.eu/audio-sample.mp3');
		const req = new Request(url, {
			method: 'GET',
			headers: { range: 'bytes=0-1024' }
		});

		expect(shouldBypassServiceWorker(url, req)).toBe(true);
	});

	it('bypasses non-GET mutation methods', () => {
		const url = new URL('https://m.halflight.eu/api/playback-state');
		expect(shouldBypassServiceWorker(url, new Request(url, { method: 'POST' }))).toBe(true);
		expect(shouldBypassServiceWorker(url, new Request(url, { method: 'DELETE' }))).toBe(true);
	});

	it('bypasses auth and OAuth callback endpoints', () => {
		const tidalAuth = new URL('https://m.halflight.eu/tidal/callback');
		const signIn = new URL('https://m.halflight.eu/sign-in');
		const lastfm = new URL('https://m.halflight.eu/lastfm/connect');

		expect(shouldBypassServiceWorker(tidalAuth, new Request(tidalAuth))).toBe(true);
		expect(shouldBypassServiceWorker(signIn, new Request(signIn))).toBe(true);
		expect(shouldBypassServiceWorker(lastfm, new Request(lastfm))).toBe(true);
	});

	it('bypasses real-time playback state and sync endpoints', () => {
		const playbackState = new URL('https://m.halflight.eu/api/playback-state');
		const favorites = new URL('https://m.halflight.eu/api/favorites');
		const playlists = new URL('https://m.halflight.eu/api/playlists');

		expect(shouldBypassServiceWorker(playbackState, new Request(playbackState))).toBe(true);
		expect(shouldBypassServiceWorker(favorites, new Request(favorites))).toBe(true);
		expect(shouldBypassServiceWorker(playlists, new Request(playlists))).toBe(true);
	});

	it('does not bypass ordinary public client assets', () => {
		const appBundle = new URL('https://m.halflight.eu/_app/immutable/entry/app.js');
		const icon = new URL('https://m.halflight.eu/icons/halflight-192.png');

		expect(shouldBypassServiceWorker(appBundle, new Request(appBundle))).toBe(false);
		expect(shouldBypassServiceWorker(icon, new Request(icon))).toBe(false);
	});

	it('identifies precache candidates accurately', () => {
		expect(isPrecacheCandidate('/offline')).toBe(true);
		expect(isPrecacheCandidate('/offline/')).toBe(true);
		expect(isPrecacheCandidate('/manifest.webmanifest')).toBe(true);
		expect(isPrecacheCandidate('/icons/halflight-192.png')).toBe(true);
		expect(isPrecacheCandidate('/_app/immutable/chunks/bundle.js')).toBe(true);
		expect(isPrecacheCandidate('/_app/immutable/assets/layout.css')).toBe(true);

		// Excludes private data json payloads
		expect(isPrecacheCandidate('/_app/immutable/__data.json')).toBe(false);
		// Excludes arbitrary routes or provider audio
		expect(isPrecacheCandidate('/api/tracks/123/audio')).toBe(false);
		expect(isPrecacheCandidate('/home')).toBe(false);
	});

	it('identifies HTML navigation requests', () => {
		const htmlReq = new Request('https://m.halflight.eu/home', {
			headers: { accept: 'text/html,application/xhtml+xml' }
		});
		expect(isNavigationRequest(htmlReq)).toBe(true);

		const navMock = {
			mode: 'navigate',
			destination: 'document',
			headers: new Headers()
		} as unknown as Request;
		expect(isNavigationRequest(navMock)).toBe(true);

		const fetchReq = new Request('https://m.halflight.eu/api/search', {
			headers: { accept: 'application/json' }
		});
		expect(isNavigationRequest(fetchReq)).toBe(false);
	});
});
