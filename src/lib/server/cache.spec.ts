import { describe, expect, it, vi } from 'vitest';
import { createRedisCache } from './cache';

describe('Redis cache', () => {
	it('does not connect when Redis is absent or malformed', async () => {
		const createClient = vi.fn();
		const cache = createRedisCache({ url: 'not a redis URL', clientFactory: createClient });

		await cache.set('taste-profile:abc', '{}', 60);
		await expect(cache.get('taste-profile:abc')).resolves.toBeNull();
		expect(createClient).not.toHaveBeenCalled();
	});

	it('uses one bounded connection and namespaces cache keys', async () => {
		const client = {
			isReady: false,
			connect: vi.fn(async () => {
				client.isReady = true;
			}),
			get: vi.fn(async () => '{"version":1}'),
			set: vi.fn(async () => 'OK'),
			del: vi.fn(async () => 1),
			on: vi.fn(),
			destroy: vi.fn()
		};
		const createClient = vi.fn(() => client);
		const cache = createRedisCache({
			url: 'redis://default:p%C3%A4ss@example.test:6379/0',
			clientFactory: createClient
		});

		await cache.set('taste-profile:abc', '{}', 60);
		await expect(cache.get('taste-profile:abc')).resolves.toBe('{"version":1}');
		await cache.delete('taste-profile:abc');

		expect(createClient).toHaveBeenCalledTimes(1);
		expect(client.set).toHaveBeenCalledWith('syn:cache:v1:taste-profile:abc', '{}', { EX: 60 });
		expect(client.get).toHaveBeenCalledWith('syn:cache:v1:taste-profile:abc');
		expect(client.del).toHaveBeenCalledWith('syn:cache:v1:taste-profile:abc');
	});

	it('rejects unbounded values, invalid keys, and excessive TTLs before Redis is called', async () => {
		const client = {
			isReady: true,
			connect: vi.fn(),
			get: vi.fn(),
			set: vi.fn(),
			del: vi.fn(),
			on: vi.fn(),
			destroy: vi.fn()
		};
		const cache = createRedisCache({
			url: 'redis://localhost:6379/0',
			clientFactory: () => client
		});

		await cache.set('../not-a-key', '{}', 60);
		await cache.set('taste-profile:abc', '{}', 301);
		await cache.set('taste-profile:abc', 'x'.repeat(256 * 1024 + 1), 60);

		expect(client.set).not.toHaveBeenCalled();
	});

	it('fails open when a Redis client cannot be created', async () => {
		const warn = vi.fn();
		const cache = createRedisCache({
			url: 'redis://localhost:6379/0',
			clientFactory: () => {
				throw new Error('unavailable');
			},
			logWarn: warn
		});

		await cache.set('taste-profile:abc', '{}', 60);

		expect(warn).toHaveBeenCalledWith('Redis cache unavailable; continuing without cache');
	});
});
