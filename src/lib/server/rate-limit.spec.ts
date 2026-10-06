import { describe, expect, it } from 'vitest';
import { classifyRequest, createRateLimiter, createRequestLimiter } from './rate-limit';

describe('createRateLimiter', () => {
	it('allows up to the limit then reports when to retry', () => {
		let t = 0;
		const limiter = createRateLimiter({ limit: 2, windowMs: 10_000 }, () => t);

		expect(limiter.hit('a').allowed).toBe(true);
		expect(limiter.hit('a').allowed).toBe(true);
		t = 4_000;
		expect(limiter.hit('a')).toEqual({ allowed: false, retryAfterSeconds: 6 });
	});

	it('resets after the window and keeps users independent', () => {
		let t = 0;
		const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 }, () => t);

		limiter.hit('a');
		expect(limiter.hit('a').allowed).toBe(false);
		expect(limiter.hit('b').allowed).toBe(true);
		t = 1_000;
		expect(limiter.hit('a').allowed).toBe(true);
	});
});

describe('request limiter', () => {
	it('classifies paths into budgets', () => {
		expect(classifyRequest('/api/tracks/1/audio')).toBe('audio');
		expect(classifyRequest('/api/tracks/1/stream')).toBe('upstream');
		expect(classifyRequest('/api/taste/generate')).toBe('generate');
		expect(classifyRequest('/api/playback-state')).toBe('api');
		expect(classifyRequest('/app/search')).toBeNull();
	});

	it('throttles one listener without affecting another', () => {
		const limiter = createRequestLimiter(() => 0);
		for (let i = 0; i < 6; i++) limiter.check('a', '/api/taste/generate');

		expect(limiter.check('a', '/api/taste/generate').allowed).toBe(false);
		expect(limiter.check('b', '/api/taste/generate').allowed).toBe(true);
	});
});
