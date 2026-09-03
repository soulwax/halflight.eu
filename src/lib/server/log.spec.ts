import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ dev: false }));

import { log } from './log';

describe('log', () => {
	let spy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		spy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => spy.mockRestore());

	it('writes one JSON line with level, message and time in production', () => {
		log.error('token store unreadable');

		expect(spy).toHaveBeenCalledTimes(1);
		const line = JSON.parse(spy.mock.calls[0][0] as string);
		expect(line).toMatchObject({ level: 'error', message: 'token store unreadable' });
		expect(typeof line.time).toBe('string');
	});

	it('redacts field keys that look like credentials', () => {
		log.error('refresh failed', {
			userId: 'u1',
			accessToken: 'secret-value',
			refresh_token: 'another',
			authorization: 'Bearer x'
		});

		const line = JSON.parse(spy.mock.calls[0][0] as string);
		expect(line).toMatchObject({
			userId: 'u1',
			accessToken: '[redacted]',
			refresh_token: '[redacted]',
			authorization: '[redacted]'
		});
	});

	it('serialises Error values to name and message only', () => {
		log.error('boom', { cause: new TypeError('bad input') });

		const line = JSON.parse(spy.mock.calls[0][0] as string);
		expect(line.cause).toEqual({ name: 'TypeError', message: 'bad input' });
	});
});
