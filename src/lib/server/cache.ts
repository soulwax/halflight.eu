import { REDIS_CACHE } from '$app/env/private';
import { createClient } from 'redis';
import { log } from '#lib/server/log';

const CACHE_NAMESPACE = 'syn:cache:v1:';
const MAX_CACHE_VALUE_BYTES = 256 * 1024;
const MAX_CACHE_TTL_SECONDS = 5 * 60;
const CONNECT_TIMEOUT_MS = 500;
const COMMAND_TIMEOUT_MS = 100;

export interface EphemeralCache {
	get(key: string): Promise<string | null>;
	set(key: string, value: string, ttlSeconds: number): Promise<void>;
	delete(key: string): Promise<void>;
}

interface RedisClient {
	isReady: boolean;
	connect(): Promise<void>;
	get(key: string): Promise<string | null>;
	set(key: string, value: string, options: { EX: number }): Promise<unknown>;
	del(key: string): Promise<unknown>;
	on(event: 'error', listener: (error: Error) => void): unknown;
	destroy(): void;
}

export interface RedisClientFactory {
	(options: {
		url: string;
		socket: { connectTimeout: number; reconnectStrategy: false };
		commandsQueueMaxLength: number;
		disableOfflineQueue: boolean;
	}): RedisClient;
}

export interface RedisCacheOptions {
	url?: string;
	clientFactory?: RedisClientFactory;
	logWarn?: (message: string) => void;
}

export const unavailableCache: EphemeralCache = {
	get() {
		return Promise.resolve(null);
	},
	set() {
		return Promise.resolve();
	},
	delete() {
		return Promise.resolve();
	}
};

function isValidKey(key: string): boolean {
	return /^[a-z0-9][a-z0-9:_-]{0,255}$/i.test(key);
}

function isValidRedisUrl(value: string | undefined): value is string {
	if (!value) return false;
	try {
		const url = new URL(value);
		return (url.protocol === 'redis:' || url.protocol === 'rediss:') && Boolean(url.hostname);
	} catch {
		return false;
	}
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	return Promise.race([
		promise,
		new Promise<T>((_resolve, reject) => {
			timeout = setTimeout(() => reject(new Error('Redis operation timed out.')), timeoutMs);
		})
	]).finally(() => {
		if (timeout) clearTimeout(timeout);
	});
}

function normaliseTtl(value: number): number | null {
	if (!Number.isInteger(value) || value < 1 || value > MAX_CACHE_TTL_SECONDS) return null;
	return value;
}

/**
 * Builds a bounded, fail-open Redis cache. It holds derived server data only:
 * a missing, unavailable, or corrupt cache is always equivalent to a cache miss.
 */
export function createRedisCache(options: RedisCacheOptions = {}): EphemeralCache {
	const warn = options.logWarn ?? ((message: string) => log.warn(message));
	if (!isValidRedisUrl(options.url)) {
		if (options.url) warn('Redis cache URL is invalid; cache disabled');
		return unavailableCache;
	}
	const redisUrl = options.url;

	const clientFactory =
		options.clientFactory ??
		((clientOptions) => createClient(clientOptions) as unknown as RedisClient);
	let client: RedisClient | null = null;
	let connection: Promise<RedisClient | null> | null = null;
	let failureReported = false;

	function reportUnavailable(): void {
		if (failureReported) return;
		failureReported = true;
		warn('Redis cache unavailable; continuing without cache');
	}

	function discardClient(): void {
		if (client) client.destroy();
		client = null;
		connection = null;
	}

	async function getClient(): Promise<RedisClient | null> {
		if (client?.isReady) return client;
		if (connection) return connection;

		let nextClient: RedisClient;
		try {
			nextClient = clientFactory({
				url: redisUrl,
				socket: { connectTimeout: CONNECT_TIMEOUT_MS, reconnectStrategy: false },
				commandsQueueMaxLength: 0,
				disableOfflineQueue: true
			});
		} catch {
			reportUnavailable();
			return null;
		}
		nextClient.on('error', () => reportUnavailable());
		client = nextClient;
		connection = withTimeout(nextClient.connect(), CONNECT_TIMEOUT_MS)
			.then(() => {
				failureReported = false;
				return nextClient;
			})
			.catch(() => {
				reportUnavailable();
				discardClient();
				return null;
			});
		return connection;
	}

	async function run(operation: (readyClient: RedisClient) => Promise<unknown>): Promise<void> {
		const readyClient = await getClient();
		if (!readyClient) return;
		try {
			await withTimeout(operation(readyClient), COMMAND_TIMEOUT_MS);
		} catch {
			reportUnavailable();
			discardClient();
		}
	}

	return {
		async get(key) {
			if (!isValidKey(key)) return null;
			const readyClient = await getClient();
			if (!readyClient) return null;
			try {
				return await withTimeout(readyClient.get(`${CACHE_NAMESPACE}${key}`), COMMAND_TIMEOUT_MS);
			} catch {
				reportUnavailable();
				discardClient();
				return null;
			}
		},
		async set(key, value, ttlSeconds) {
			const ttl = normaliseTtl(ttlSeconds);
			if (!isValidKey(key) || !ttl || Buffer.byteLength(value, 'utf8') > MAX_CACHE_VALUE_BYTES)
				return;
			await run((readyClient) => readyClient.set(`${CACHE_NAMESPACE}${key}`, value, { EX: ttl }));
		},
		async delete(key) {
			if (!isValidKey(key)) return;
			await run((readyClient) => readyClient.del(`${CACHE_NAMESPACE}${key}`));
		}
	};
}

export const redisCache = createRedisCache({ url: REDIS_CACHE });
