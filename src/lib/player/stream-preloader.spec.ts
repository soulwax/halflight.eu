import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	getOrAwaitPreloadedStreamData,
	loadStreamData,
	streamLoader,
	streamPreloader
} from './stream-preloader.js';

afterEach(() => {
	streamPreloader.clear();
	vi.unstubAllGlobals();
});

describe('loadStreamData', () => {
	it('preserves the safe server error category for recovery UI', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.resolve(Response.json({ error: 'track_unavailable' }, { status: 404 })))
		);
		await expect(streamLoader.load('gone')).resolves.toMatchObject({
			ok: false,
			reason: 'track_unavailable'
		});
	});
	it('keeps only display fields and rejects malformed successful responses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() =>
				Promise.resolve(
					Response.json({
						audioQuality: 'HIGH',
						urls: ['https://private.test'],
						token: 'fixture',
						sampleRate: '44100'
					})
				)
			)
		);
		await expect(loadStreamData('t1')).resolves.toEqual({ audioQuality: 'HIGH' });
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.resolve(Response.json({ urls: ['https://private.test'] })))
		);
		await expect(loadStreamData('t1')).resolves.toBeNull();
	});
	it('reads stream metadata from the encoded /stream endpoint', async () => {
		const body = { audioQuality: 'LOSSLESS', codecs: 'flac', bitDepth: 16, sampleRate: 44100 };
		const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body))));
		vi.stubGlobal('fetch', fetchMock);

		await expect(loadStreamData('a/b')).resolves.toEqual(body);
		expect(fetchMock).toHaveBeenCalledWith('/api/tracks/a%2Fb/stream', { signal: null });
	});

	it('treats an error status or an unreadable body as not directly playable', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.resolve(new Response('{}', { status: 403 })))
		);
		await expect(loadStreamData('t1')).resolves.toBeNull();

		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.resolve(new Response('not json')))
		);
		await expect(loadStreamData('t1')).resolves.toBeNull();
	});
});

describe('streamPreloader', () => {
	it('preloads through the /stream loader and hands the entry out once', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.resolve(new Response(JSON.stringify({ audioQuality: 'HIGH' }))))
		);

		streamPreloader.preload('t1');
		await expect(streamPreloader.getOrAwait('t1')).resolves.toEqual({ audioQuality: 'HIGH' });
		expect(streamPreloader.consume('t1')).toBeNull();
	});

	it('keeps look-ahead work alive until a foreground handoff is canceled', async () => {
		let preloadSignal: AbortSignal | null = null;
		const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
			preloadSignal = init?.signal ?? null;
			return new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener(
					'abort',
					() => reject(new DOMException('Aborted', 'AbortError')),
					{ once: true }
				);
			});
		});
		vi.stubGlobal('fetch', fetchMock);

		streamPreloader.preload('joined');
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
		expect(preloadSignal?.aborted).toBe(false);

		const foreground = new AbortController();
		const handoff = getOrAwaitPreloadedStreamData('joined', foreground.signal);
		foreground.abort();

		await expect(handoff).resolves.toBeNull();
		expect(preloadSignal?.aborted).toBe(true);
	});
});
