import { getTidalConfig } from './config';
import { seal, open } from './crypto';
import { TidalStoreError } from './errors';

export interface TidalTokenRecord {
	accessToken: string;
	refreshToken: string;
	/** Absolute expiry, epoch milliseconds. */
	expiresAt: number;
	tokenType: string;
	scope: string[];
	/** When this record was obtained/refreshed, epoch milliseconds. */
	obtainedAt: number;
	/** TIDAL user id from the token response, when present. */
	userId?: string;
}

/**
 * Which stored token a store operation targets.
 * - `primary`   — developer OAuth token (JSON:API v2 browse surface)
 * - `playback`  — TIDAL Link device token (`api.tidal.com/v1` playback surface)
 */
export type TokenSlot = 'primary' | 'playback';

/**
 * Persistence primitive for the encrypted token blobs. Swappable so tests can
 * run without a database.
 */
export interface TokenRowStore {
	read(slot?: TokenSlot): Promise<string | null>;
	write(secret: string, slot?: TokenSlot): Promise<void>;
	clear(slot?: TokenSlot): Promise<void>;
}

/**
 * Default {@link TokenRowStore}: the `tidal_auth` singleton row via Drizzle. The
 * database module is imported lazily so that importing this file (e.g. in a unit
 * test with an injected store) does not require `DATABASE_URL`.
 */
export const dbTokenRowStore: TokenRowStore = {
	async read(slot = 'primary') {
		const [{ db }, { tidalAuth }, { eq }] = await Promise.all([
			import('#lib/server/db'),
			import('#lib/server/db/schema'),
			import('drizzle-orm')
		]);
		const column = slot === 'playback' ? tidalAuth.playbackSecret : tidalAuth.secret;
		const rows = await db
			.select({ secret: column })
			.from(tidalAuth)
			.where(eq(tidalAuth.id, 1))
			.limit(1);
		return rows[0]?.secret ?? null;
	},
	async write(secret, slot = 'primary') {
		const [{ db }, { tidalAuth }] = await Promise.all([
			import('#lib/server/db'),
			import('#lib/server/db/schema')
		]);
		const now = new Date();
		const insert =
			slot === 'playback'
				? { id: 1, playbackSecret: secret, updatedAt: now }
				: { id: 1, secret, updatedAt: now };
		const update =
			slot === 'playback' ? { playbackSecret: secret, updatedAt: now } : { secret, updatedAt: now };
		await db
			.insert(tidalAuth)
			.values(insert)
			.onConflictDoUpdate({ target: tidalAuth.id, set: update });
	},
	async clear(slot = 'primary') {
		const [{ db }, { tidalAuth }, { eq }] = await Promise.all([
			import('#lib/server/db'),
			import('#lib/server/db/schema'),
			import('drizzle-orm')
		]);
		const set =
			slot === 'playback'
				? { playbackSecret: null, updatedAt: new Date() }
				: { secret: null, updatedAt: new Date() };
		await db.update(tidalAuth).set(set).where(eq(tidalAuth.id, 1));
	}
};

function isRecord(value: unknown): value is TidalTokenRecord {
	if (typeof value !== 'object' || value === null) return false;
	const r = value as Record<string, unknown>;
	return (
		typeof r.accessToken === 'string' &&
		typeof r.refreshToken === 'string' &&
		typeof r.expiresAt === 'number' &&
		typeof r.tokenType === 'string' &&
		Array.isArray(r.scope)
	);
}

async function readSlot(slot: TokenSlot, store: TokenRowStore): Promise<TidalTokenRecord | null> {
	const secret = await store.read(slot);
	if (!secret) return null;

	const plaintext = open(secret, getTidalConfig().encryptionKey);
	let parsed: unknown;
	try {
		parsed = JSON.parse(plaintext);
	} catch {
		throw new TidalStoreError('Stored token record is not valid JSON.');
	}
	if (!isRecord(parsed)) {
		throw new TidalStoreError('Stored token record is missing required fields.');
	}
	return parsed;
}

async function writeSlot(
	slot: TokenSlot,
	record: TidalTokenRecord,
	store: TokenRowStore
): Promise<void> {
	await store.write(seal(JSON.stringify(record), getTidalConfig().encryptionKey), slot);
}

/**
 * Load and decrypt the primary (developer OAuth) token record. Returns `null`
 * when nothing is stored; throws {@link TidalStoreError} when a blob exists but
 * cannot be read.
 */
export function readRecord(
	store: TokenRowStore = dbTokenRowStore
): Promise<TidalTokenRecord | null> {
	return readSlot('primary', store);
}

/** Encrypt and atomically upsert the primary token record. */
export function writeRecord(
	record: TidalTokenRecord,
	store: TokenRowStore = dbTokenRowStore
): Promise<void> {
	return writeSlot('primary', record, store);
}

/** Remove the stored primary token record. */
export function clearRecord(store: TokenRowStore = dbTokenRowStore): Promise<void> {
	return store.clear('primary');
}

/** Load and decrypt the TIDAL Link (device) playback token record. */
export function readPlaybackRecord(
	store: TokenRowStore = dbTokenRowStore
): Promise<TidalTokenRecord | null> {
	return readSlot('playback', store);
}

/** Encrypt and atomically upsert the playback token record. */
export function writePlaybackRecord(
	record: TidalTokenRecord,
	store: TokenRowStore = dbTokenRowStore
): Promise<void> {
	return writeSlot('playback', record, store);
}

/** Remove the stored playback token record. */
export function clearPlaybackRecord(store: TokenRowStore = dbTokenRowStore): Promise<void> {
	return store.clear('playback');
}
