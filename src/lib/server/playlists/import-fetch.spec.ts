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

describe('paced import requests', () => {
	it('paces concurrent catalogue calls and waits for Retry-After without losing the current request', async () => {
		const starts: number[] = [];
		const send = vi.fn(async () => {
			starts.push(Date.now());
			return starts.length === 1
				? new Response('{}', { status: 429, headers: { 'Retry-After': '4' } })
				: new Response('{}');
		});
		const fetch = createImportFetch(send);
		const first = fetch('https://openapi.tidal.com/v2/tracks/1');
		const second = fetch('https://openapi.tidal.com/v2/searchResults/test');
		await vi.advanceTimersByTimeAsync(3999);
		expect(send).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(5501);
		expect((await first).status).toBe(200);
		expect((await second).status).toBe(200);
		expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(4000);
		expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(1500);
	});
	it('supports HTTP-date cooldowns and conservative missing headers', () => {
		expect(retryAfterMs('Thu, 08 Oct 2026 12:00:04 GMT', Date.parse('2026-10-08T12:00:00Z'))).toBe(
			4000
		);
		expect(retryAfterMs(null)).toBe(30000);
	});
	it('allows cancellation during cooldown and releases the lane for later requests', async () => {
		const send = vi
			.fn()
			.mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '4' } }))
			.mockResolvedValue(new Response('{}'));
		const controller = new AbortController();
		const fetch = createImportFetch(send);
		const pending = fetch('https://openapi.tidal.com/v2/tracks/1', { signal: controller.signal });
		const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
		await vi.advanceTimersByTimeAsync(100);
		controller.abort();
		await assertion;
		const next = fetch('https://openapi.tidal.com/v2/tracks/2');
		await vi.advanceTimersByTimeAsync(5000);
		expect((await next).status).toBe(200);
	});
});
