import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import { REDIS_CACHE } from '$app/env/private';
import {
	applyPlaybackIntent,
	parsePlaybackIntent,
	playbackIntentFingerprint,
	type PlaybackIntent,
	type PlaybackIntentResult
} from './playback-state';

/** A secondary buffer only: Postgres remains the acknowledgement authority. */
export interface PlaybackBuffer {
	list(ownerId: string): Promise<PlaybackIntent[]>;
	put(ownerId: string, intent: PlaybackIntent): Promise<boolean>;
	remove(ownerId: string, operationId: string): Promise<void>;
}

// Keep payloads and their insertion order in one key: eviction cannot leave
// an acknowledged payload detached from the recovery index.
const ADD = `
local payloadKey = 'operation:' .. ARGV[1]
local fingerprintKey = 'fingerprint:' .. ARGV[1]
if redis.call('HEXISTS', KEYS[1], payloadKey) == 1 then
 return redis.call('HGET', KEYS[1], fingerprintKey) == ARGV[3] and 1 or 0
end
local order = cjson.decode(redis.call('HGET', KEYS[1], 'order') or '[]')
if #order >= 40 then return 0 end
table.insert(order, ARGV[1])
redis.call('HSET', KEYS[1], payloadKey, ARGV[2], fingerprintKey, ARGV[3], 'order', cjson.encode(order))
return 1`;
const LIST = `
local result = {}
local order = cjson.decode(redis.call('HGET', KEYS[1], 'order') or '[]')
for _, id in ipairs(order) do
 local payload = redis.call('HGET', KEYS[1], 'operation:' .. id)
 if payload then table.insert(result, payload) end
end
return result`;
const REMOVE = `
redis.call('HDEL', KEYS[1], 'operation:' .. ARGV[1], 'fingerprint:' .. ARGV[1])
local order = cjson.decode(redis.call('HGET', KEYS[1], 'order') or '[]')
local remaining = {}
for _, id in ipairs(order) do
 if id ~= ARGV[1] then table.insert(remaining, id) end
end
if #remaining == 0 then redis.call('DEL', KEYS[1])
else redis.call('HSET', KEYS[1], 'order', cjson.encode(remaining)) end
return 1`;

let client: ReturnType<typeof createClient> | undefined;
let connecting: Promise<void> | undefined;
let retryAfter = 0;

async function connection() {
	if (!REDIS_CACHE) return null;
	if (client?.isReady) return client;
	if (Date.now() < retryAfter) return null;
	if (!connecting) {
		client = createClient({
			url: REDIS_CACHE,
			disableOfflineQueue: true,
			socket: { connectTimeout: 500, reconnectStrategy: false }
		});
		client.on('error', () => {
			/* Credentials and connection URLs never reach logs. */
		});
		const current = client;
		let timer: ReturnType<typeof setTimeout> | undefined;
		connecting = Promise.race([
			current.connect(),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error('Playback buffer connection timed out')), 500);
			})
		])
			.then(
				() => {},
				() => {
					retryAfter = Date.now() + 5_000;
					if (current.isOpen) current.destroy();
				}
			)
			.finally(() => {
				if (timer) clearTimeout(timer);
				connecting = undefined;
			});
	}
	await connecting;
	return client?.isReady ? client : null;
}

function keys(ownerId: string): string[] {
	const ownerKey = createHash('sha256').update(ownerId).digest('hex');
	return [`halflight:playback:{${ownerKey}}:pending`];
}

async function command(script: string, ownerId: string, args: string[] = []) {
	const connected = await connection();
	if (!connected) throw new Error('Playback buffer unavailable');
	return connected.withCommandOptions({ abortSignal: AbortSignal.timeout(250) }).eval(script, {
		keys: keys(ownerId),
		arguments: args
	});
}

export const redisPlaybackBuffer: PlaybackBuffer = {
	async list(ownerId) {
		const result = await command(LIST, ownerId);
		if (!Array.isArray(result)) return [];
		return result
			.map((payload) => {
				try {
					return parsePlaybackIntent(JSON.parse(String(payload)));
				} catch {
					return null;
				}
			})
			.filter((intent): intent is PlaybackIntent => intent !== null);
	},
	async put(ownerId, intent) {
		return (
			(await command(ADD, ownerId, [
				intent.operationId,
				JSON.stringify(intent),
				playbackIntentFingerprint(intent)
			])) === 1
		);
	},
	async remove(ownerId, operationId) {
		await command(REMOVE, ownerId, [operationId]);
	}
};

export interface BufferedPlaybackDependencies {
	buffer: PlaybackBuffer;
	apply: typeof applyPlaybackIntent;
}
const defaults: BufferedPlaybackDependencies = {
	buffer: redisPlaybackBuffer,
	apply: applyPlaybackIntent
};

/** Replay in insertion order; stable operation IDs make a lost acknowledgement safe. */
export async function recoverBufferedPlayback(
	ownerId: string,
	dependencies = defaults
): Promise<void> {
	const pending = await dependencies.buffer.list(ownerId).catch(() => []);
	for (const intent of pending) {
		let result = await dependencies.apply(ownerId, intent);
		if (result.conflict && !result.invalid) {
			result = await dependencies.apply(ownerId, {
				...intent,
				expectedRevision: result.state.revision
			});
		}
		if (result.conflict && !result.invalid) throw new Error('Buffered playback conflict');
		// A stale remove/move can be permanently inapplicable. It must not block
		// subsequent accepted operations, matching the client's existing policy.
		await dependencies.buffer.remove(ownerId, intent.operationId).catch(() => {});
	}
}

export async function applyBufferedPlaybackIntent(
	ownerId: string,
	intent: PlaybackIntent,
	dependencies = defaults
): Promise<PlaybackIntentResult | { buffered: true }> {
	try {
		await recoverBufferedPlayback(ownerId, dependencies);
		const result = await dependencies.apply(ownerId, intent);
		if (!result.conflict || result.invalid) {
			await dependencies.buffer.remove(ownerId, intent.operationId).catch(() => {});
		}
		return result;
	} catch (cause) {
		if (await dependencies.buffer.put(ownerId, intent).catch(() => false))
			return { buffered: true };
		throw cause;
	}
}
