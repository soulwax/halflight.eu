import { createHash } from 'node:crypto';
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

interface BucketClient {
	send(command: unknown): Promise<unknown>;
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
	if (expiry && expiry > Date.now()) return false;
	await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
	return true;
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
	}
};

export function createTidalSegmentCache(
	config: TidalSegmentCacheConfig,
	client?: BucketClient
): TidalSegmentCache {
	if (!config.enabled || !configured(config)) return unavailable;
	const bucketClient =
		client ??
		(new S3Client({
			region: config.region || 'auto',
			endpoint: config.endpoint,
			forcePathStyle: true,
			credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
		}) as unknown as BucketClient);

	return {
		enabled: true,
		async head(cacheKey) {
			const key = objectKey(cacheKey);
			if (!key) return null;
			try {
				const response = (await bucketClient.send(
					new HeadObjectCommand({ Bucket: config.bucket, Key: key })
				)) as {
					ContentLength?: number;
					ContentType?: string;
					Metadata?: Record<string, string>;
				};
				if (await expired(bucketClient, config.bucket, key, response.Metadata)) return null;
				if (!usableLength(response.ContentLength)) return null;
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
				if (await expired(bucketClient, config.bucket, key, response.Metadata)) return null;
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
					Metadata: { 'expires-at': String(expiry) }
				})
			);
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
