import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamPreloader } from './stream-preloader.js';

describe('StreamPreloader', () => {
	let preloader: StreamPreloader;

	beforeEach(() => {
		preloader = new StreamPreloader();
	});

	afterEach(() => {
		preloader.clear();
		vi.unstubAllGlobals();
	});

	it('returns null when no metadata has been preloaded', () => {
		expect(preloader.consume('track-nonexistent')).toBeNull();
	});

	it('preloads and caches metadata from the stream endpoint', async () => {
		const mockData = {
			audioQuality: 'LOSSLESS',
			codecs: 'flac',
			bitDepth: 16,
			sampleRate: 44100
		};

		vi.stubGlobal(
			'fetch',
			vi.fn((url: string) => {
				if (String(url).includes('/stream')) {
					return Promise.resolve(new Response(JSON.stringify(mockData), { status: 200 }));
				}
				return Promise.reject(new Error('not found'));
			})
		);

		preloader.preload('track-123');

		// Wait for inflight fetch
		const data = await preloader.getOrAwait('track-123');
		expect(data).toMatchObject({
			audioQuality: 'LOSSLESS',
			codecs: 'flac',
			bitDepth: 16,
			sampleRate: 44100
		});

		// Subsequent consume is null because it was consumed
		expect(preloader.consume('track-123')).toBeNull();
	});
});
