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
 * Persistence primitive for the single encrypted row. Swappable so tests can run
 * without a database.
 */
export interface TokenRowStore {
	read(): Promise<string | null>;
	write(secret: string): Promise<void>;
	clear(): Promise<void>;
}

/**
 * Default {@link TokenRowStore}: the `tidal_auth` singleton row via Drizzle. The
 * database module is imported lazily so that importing this file (e.g. in a unit
 * test with an injected store) does not require `DATABASE_URL`.
 */
export const dbTokenRowStore: TokenRowStore = {
	async read() {
		const [{ db }, { tidalAuth }, { eq }] = await Promise.all([
			import('#lib/server/db'),
			import('#lib/server/db/schema'),
			import('drizzle-orm')
		]);
		const rows = await db
			.select({ secret: tidalAuth.secret })
			.from(tidalAuth)
			.where(eq(tidalAuth.id, 1))
			.limit(1);
		return rows[0]?.secret ?? null;
	},
	async write(secret) {
		const [{ db }, { tidalAuth }] = await Promise.all([
			import('#lib/server/db'),
			import('#lib/server/db/schema')
		]);
		await db
			.insert(tidalAuth)
			.values({ id: 1, secret })
			.onConflictDoUpdate({ target: tidalAuth.id, set: { secret, updatedAt: new Date() } });
	},
	async clear() {
		const [{ db }, { tidalAuth }, { eq }] = await Promise.all([
			import('#lib/server/db'),
			import('#lib/server/db/schema'),
			import('drizzle-orm')
		]);
		await db.delete(tidalAuth).where(eq(tidalAuth.id, 1));
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

/**
 * Load and decrypt the stored token record. Returns `null` when nothing is
 * stored; throws {@link TidalStoreError} when a row exists but cannot be read.
 */
export async function readRecord(
	store: TokenRowStore = dbTokenRowStore
): Promise<TidalTokenRecord | null> {
	const secret = await store.read();
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

/** Encrypt and atomically upsert the token record. */
export async function writeRecord(
	record: TidalTokenRecord,
	store: TokenRowStore = dbTokenRowStore
): Promise<void> {
	await store.write(seal(JSON.stringify(record), getTidalConfig().encryptionKey));
}

/** Permanently remove the stored token record. */
export async function clearRecord(store: TokenRowStore = dbTokenRowStore): Promise<void> {
	await store.clear();
}
