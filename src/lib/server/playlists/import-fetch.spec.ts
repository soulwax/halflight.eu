import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImportFetch, resetImportFetch, retryAfterMs } from './import-fetch';

const limited = (retryAfter = '2') =>
	new Response('{}', { status: 429, headers: { 'retry-after': retryAfter } });

beforeEach(() => {
	resetImportFetch();
	vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('import fetch pacing', () => {
	it('waits out Retry-After and retries a throttled read on the same lane', async () => {
		const upstream = vi
			.fn()
			.mockResolvedValueOnce(limited('2'))
			.mockResolvedValue(new Response('{}', { status: 200 }));
		const pending = createImportFetch(upstream)('https://api.tidal.com/v1/tracks/1/playbackinfo');
		await vi.advanceTimersByTimeAsync(1_999);
		expect(upstream).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(1);
		expect((await pending).status).toBe(200);
		expect(upstream).toHaveBeenCalledTimes(2);
	});

	it('holds the next request on a lane until the cooldown has passed', async () => {
		const upstream = vi
			.fn()
			.mockResolvedValueOnce(limited('5'))
			.mockResolvedValue(new Response('{}', { status: 200 }));
		const paced = createImportFetch(upstream);
		const first = paced('https://api.tidal.com/v1/tracks/1/playbackinfo');
		const second = paced('https://api.tidal.com/v1/tracks/2/playbackinfo');
		await vi.advanceTimersByTimeAsync(4_999);
		expect(upstream).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(10_000);
		await Promise.all([first, second]);
		expect(upstream).toHaveBeenCalledTimes(3);
	});

	it('returns the 429 instead of waiting past the cooldown budget', async () => {
		const upstream = vi.fn().mockResolvedValue(limited('600'));
		const response = await createImportFetch(upstream)('https://openapi.tidal.com/v2/tracks/1');
		expect(response.status).toBe(429);
		expect(upstream).toHaveBeenCalledOnce();
	});

	it('does not pace requests to other hosts', async () => {
		const upstream = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
		const paced = createImportFetch(upstream);
		await Promise.all([paced('https://example.com/a'), paced('https://example.com/b')]);
		expect(upstream).toHaveBeenCalledTimes(2);
	});

	it('reads Retry-After as seconds or an HTTP date, with a floor and a default', () => {
		const now = Date.parse('2026-10-08T00:00:00Z');
		expect(retryAfterMs('3', now)).toBe(3_000);
		expect(retryAfterMs('0', now)).toBe(1_000);
		expect(retryAfterMs('Thu, 08 Oct 2026 00:00:10 GMT', now)).toBe(10_000);
		expect(retryAfterMs(null, now)).toBe(30_000);
	});
});
