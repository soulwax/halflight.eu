import { createHash } from 'node:crypto';
import {
	dbSegmentCacheIndex,
	SWEEP_BATCH_SIZE,
	type SegmentCacheIndex
} from './segment-cache-index';
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import {
	HALFLIGHT_TIDAL_CACHE_BUCKET,
	HALFLIGHT_TIDAL_CACHE_BUCKET_ACCESS_KEY_ID,
	HALFLIGHT_TIDAL_CACHE_ENABLED,
	HALFLIGHT_TIDAL_CACHE_BUCKET_ENDPOINT,
	HALFLIGHT_TIDAL_CACHE_BUCKET_REGION,
	HALFLIGHT_TIDAL_CACHE_BUCKET_SECRET_ACCESS_KEY
} from '$app/env/private';

const PREFIX = 'syn-tidal-cache/v1/';
const RETENTION_MS = 15 * 60_000;
const MAX_OBJECT_BYTES = 128 * 1024 * 1024;
const CACHE_KEY = /^[a-z0-9:_-]{1,160}$/i;
const SIZE_METADATA_KEY = 'size-bytes';

/**
 * Bounds on every call to the object store.
 *
 * `head` and `get` are awaited on the `/api/tracks/[id]/audio` path, so an
 * unreachable or slow store must degrade to a cache miss rather than stall
 * playback. The SDK defaults are three attempts with no connect or socket
 * bound, which can hang a request indefinitely. `#lib/server/cache` (Redis)
 * already applies the same discipline for the same reason.
 */
const CONNECT_TIMEOUT_MS = 2_000;
/** Socket inactivity, not total duration — `get` streams a whole track body. */
const SOCKET_TIMEOUT_MS = 15_000;
/** One retry rather than the SDK's three: a cache miss is always a safe answer. */
const MAX_ATTEMPTS = 2;
/** `head` is a small metadata probe on the hot path, so bound it harder still. */
const HEAD_TIMEOUT_MS = 2_000;

interface BucketClient {
	send(command: unknown, options?: { abortSignal?: AbortSignal }): Promise<unknown>;
}

interface ObjectBody {
	transformToWebStream?: () => ReadableStream<Uint8Array>;
}

export interface TidalSegmentCacheConfig {
	enabled?: boolean;
	bucket?: string;
	endpoint?: string;
	region?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
}

export interface TidalSegmentCacheObject {
	body: ReadableStream<Uint8Array>;
	contentLength?: number;
	contentRange?: string;
	contentType: string;
}

export interface TidalSegmentCacheHead {
	contentLength: number;
	contentType: string;
}

/**
 * A deliberately narrow cache for completed HiRes DASH assemblies. It is not
 * a general media store: keys are internal cache identities, objects are short
 * lived, and callers never receive a bucket URL.
 */
export interface TidalSegmentCache {
	readonly enabled: boolean;
	head(cacheKey: string): Promise<TidalSegmentCacheHead | null>;
	get(cacheKey: string, range?: string | null): Promise<TidalSegmentCacheObject | null>;
	put(input: { cacheKey: string; bytes: Uint8Array; contentType: string }): Promise<void>;
	/**
	 * Delete objects whose retention has elapsed, using Syn's own index of what
	 * it wrote. Returns how many were reclaimed. Safe to call often: it is
	 * bounded, idempotent, and a no-op when nothing has expired.
	 */
	sweep(now?: Date): Promise<number>;
}

function configured(config: TidalSegmentCacheConfig): config is Required<TidalSegmentCacheConfig> {
	if (!config.bucket || !config.endpoint || !config.accessKeyId || !config.secretAccessKey) {
		return false;
	}
	try {
		const endpoint = new URL(config.endpoint);
		return ['http:', 'https:'].includes(endpoint.protocol) && Boolean(endpoint.hostname);
	} catch {
		return false;
	}
}

function validRange(range: string | null | undefined): range is string {
	return Boolean(range && /^bytes=(?:\d+-\d*|-\d+)$/i.test(range.trim()));
}

function objectKey(cacheKey: string): string | null {
	if (!CACHE_KEY.test(cacheKey)) return null;
	return `${PREFIX}${createHash('sha256').update(cacheKey).digest('hex')}.mp4`;
}

function expiresAt(metadata: Record<string, string> | undefined): number | null {
	const value = Number(metadata?.['expires-at']);
	return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function storedSize(metadata: Record<string, string> | undefined): number | null {
	const value = Number(metadata?.[SIZE_METADATA_KEY]);
	return Number.isSafeInteger(value) && value > 0 && value <= MAX_OBJECT_BYTES ? value : null;
}

function bodyFrom(response: { Body?: ObjectBody }): ReadableStream<Uint8Array> | null {
	return response.Body?.transformToWebStream?.() ?? null;
}

function usableLength(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

async function expired(
	client: BucketClient,
	bucket: string,
	key: string,
	metadata: Record<string, string> | undefined
): Promise<boolean> {
	const expiry = expiresAt(metadata);
	if (expiry && expiry > Date.now() && storedSize(metadata) !== null) return false;
	await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
	return true;
}

function validFullObjectLength(length: unknown, expected: number): length is number {
	return usableLength(length) && length === expected;
}

function validRangeObjectLength(
	contentRange: unknown,
	length: unknown,
	expectedTotal: number
): boolean {
	if (typeof contentRange !== 'string' || !usableLength(length)) return false;
	const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange);
	if (!match) return false;
	const start = Number(match[1]);
	const end = Number(match[2]);
	const total = Number(match[3]);
	return (
		Number.isSafeInteger(start) &&
		Number.isSafeInteger(end) &&
		Number.isSafeInteger(total) &&
		start <= end &&
		end < total &&
		total === expectedTotal &&
		end - start + 1 === length
	);
}

async function cancelBody(response: { Body?: ObjectBody }): Promise<void> {
	await response.Body?.transformToWebStream?.()
		.cancel()
		.catch(() => undefined);
}

const unavailable: TidalSegmentCache = {
	enabled: false,
	head() {
		return Promise.resolve(null);
	},
	get() {
		return Promise.resolve(null);
	},
	put() {
		return Promise.resolve();
	},
	sweep() {
		return Promise.resolve(0);
	}
};

export function createTidalSegmentCache(
	config: TidalSegmentCacheConfig,
	client?: BucketClient,
	index: SegmentCacheIndex = dbSegmentCacheIndex
): TidalSegmentCache {
	if (!config.enabled || !configured(config)) return unavailable;
	const bucketClient =
		client ??
		(new S3Client({
			region: config.region || 'auto',
			endpoint: config.endpoint,
			forcePathStyle: true,
			maxAttempts: MAX_ATTEMPTS,
			requestHandler: {
				connectionTimeout: CONNECT_TIMEOUT_MS,
				requestTimeout: SOCKET_TIMEOUT_MS
			},
			credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
		}) as unknown as BucketClient);

	return {
		enabled: true,
		async head(cacheKey) {
			const key = objectKey(cacheKey);
			if (!key) return null;
			try {
				const response = (await bucketClient.send(
					new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
					// Deliberately not applied to `get`: that response streams a whole
					// track, and this signal would abort the body mid-download.
					{ abortSignal: AbortSignal.timeout(HEAD_TIMEOUT_MS) }
				)) as {
					ContentLength?: number;
					ContentType?: string;
					Metadata?: Record<string, string>;
				};
				if (await expired(bucketClient, config.bucket, key, response.Metadata)) return null;
				const expected = storedSize(response.Metadata);
				if (expected === null || !validFullObjectLength(response.ContentLength, expected))
					return null;
				return {
					contentLength: response.ContentLength,
					contentType: response.ContentType ?? 'audio/mp4'
				};
			} catch {
				return null;
			}
		},
		async get(cacheKey, range) {
			const key = objectKey(cacheKey);
			if (!key) return null;
			try {
				const response = (await bucketClient.send(
					new GetObjectCommand({
						Bucket: config.bucket,
						Key: key,
						...(validRange(range) ? { Range: range.trim() } : {})
					})
				)) as {
					Body?: ObjectBody;
					ContentLength?: number;
					ContentRange?: string;
					ContentType?: string;
					Metadata?: Record<string, string>;
				};
				if (await expired(bucketClient, config.bucket, key, response.Metadata)) {
					await cancelBody(response);
					return null;
				}
				const expected = storedSize(response.Metadata);
				const shapeIsValid = validRange(range)
					? validRangeObjectLength(response.ContentRange, response.ContentLength, expected ?? -1)
					: expected !== null && validFullObjectLength(response.ContentLength, expected);
				if (!shapeIsValid) {
					await cancelBody(response);
					return null;
				}
				const body = bodyFrom(response);
				if (!body) return null;
				return {
					body,
					contentLength: usableLength(response.ContentLength) ? response.ContentLength : undefined,
					contentRange: response.ContentRange,
					contentType: response.ContentType ?? 'audio/mp4'
				};
			} catch {
				// Cache errors must never prevent the direct TIDAL path from playing.
				return null;
			}
		},
		async put({ cacheKey, bytes, contentType }) {
			const key = objectKey(cacheKey);
			if (!key || bytes.byteLength === 0 || bytes.byteLength > MAX_OBJECT_BYTES) return;
			const expiry = Date.now() + RETENTION_MS;
			await bucketClient.send(
				new PutObjectCommand({
					Bucket: config.bucket,
					Key: key,
					Body: bytes,
					ContentType: contentType,
					Expires: new Date(expiry),
					Metadata: {
						'expires-at': String(expiry),
						[SIZE_METADATA_KEY]: String(bytes.byteLength)
					}
				})
			);
			// Record only after the write lands. An index entry for an object that
			// does not exist would make the sweeper delete nothing; the reverse — an
			// object with no entry — is the leak this index exists to prevent.
			await index.record({
				objectKey: key,
				expiresAt: new Date(expiry),
				sizeBytes: bytes.byteLength
			});
		},

		async sweep(now = new Date()) {
			const keys = await index.claimExpired(now, SWEEP_BATCH_SIZE);
			if (keys.length === 0) return 0;

			// `DeleteObject` is idempotent, so an object already gone (lazily deleted
			// on a read, or removed out of band) still settles as a success and its
			// row is forgotten. Only a genuine failure keeps the row for a later run.
			const settled = await Promise.all(
				keys.map(async (key) => {
					try {
						await bucketClient.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
						return key;
					} catch {
						return null;
					}
				})
			);
			const reclaimed = settled.filter((key): key is string => key !== null);
			await index.forget(reclaimed);
			return reclaimed.length;
		}
	};
}

export const tidalSegmentCache = createTidalSegmentCache({
	enabled: HALFLIGHT_TIDAL_CACHE_ENABLED === 'true',
	bucket: HALFLIGHT_TIDAL_CACHE_BUCKET,
	endpoint: HALFLIGHT_TIDAL_CACHE_BUCKET_ENDPOINT,
	region: HALFLIGHT_TIDAL_CACHE_BUCKET_REGION,
	accessKeyId: HALFLIGHT_TIDAL_CACHE_BUCKET_ACCESS_KEY_ID,
	secretAccessKey: HALFLIGHT_TIDAL_CACHE_BUCKET_SECRET_ACCESS_KEY
});
