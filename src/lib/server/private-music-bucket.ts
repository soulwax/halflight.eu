import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import {
	HALFLIGHT_PRIVATE_MUSIC_BUCKET,
	HALFLIGHT_PRIVATE_MUSIC_BUCKET_ACCESS_KEY_ID,
	HALFLIGHT_PRIVATE_MUSIC_BUCKET_ENDPOINT,
	HALFLIGHT_PRIVATE_MUSIC_BUCKET_REGION,
	HALFLIGHT_PRIVATE_MUSIC_BUCKET_SECRET_ACCESS_KEY
} from '$app/env/private';

const PRIVATE_MUSIC_PREFIX = 'halflight-private-music/v1/';

interface BucketClient {
	send(command: unknown): Promise<unknown>;
}

export interface PrivateMusicBucketConfig {
	bucket?: string;
	endpoint?: string;
	region?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
}

export interface PrivateMusicBucket {
	readonly enabled: boolean;
	put(key: string, content: Uint8Array, contentType: string): Promise<void>;
	get(key: string): Promise<ReadableStream<Uint8Array> | null>;
	delete(key: string): Promise<void>;
}

function validKey(key: string): boolean {
	return new RegExp(`^${PRIVATE_MUSIC_PREFIX}[0-9a-f-]{36}$`, 'i').test(key);
}

function configured(
	config: PrivateMusicBucketConfig
): config is Required<PrivateMusicBucketConfig> {
	if (!config.bucket || !config.endpoint || !config.accessKeyId || !config.secretAccessKey)
		return false;
	try {
		return ['http:', 'https:'].includes(new URL(config.endpoint).protocol);
	} catch {
		return false;
	}
}

const unavailable: PrivateMusicBucket = {
	enabled: false,
	put() {
		return Promise.reject(new Error('Private music bucket is not configured.'));
	},
	get() {
		return Promise.resolve(null);
	},
	delete() {
		return Promise.resolve();
	}
};

export function createPrivateMusicBucket(
	config: PrivateMusicBucketConfig,
	client?: BucketClient
): PrivateMusicBucket {
	if (!configured(config)) return unavailable;
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
		async put(key, content, contentType) {
			if (!validKey(key)) throw new Error('Invalid private music object key.');
			await bucketClient.send(
				new PutObjectCommand({
					Bucket: config.bucket,
					Key: key,
					Body: content,
					ContentType: contentType
				})
			);
		},
		async get(key) {
			if (!validKey(key)) return null;
			const response = (await bucketClient.send(
				new GetObjectCommand({ Bucket: config.bucket, Key: key })
			)) as { Body?: { transformToWebStream?: () => ReadableStream<Uint8Array> } };
			return response.Body?.transformToWebStream?.() ?? null;
		},
		async delete(key) {
			if (!validKey(key)) return;
			await bucketClient.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
		}
	};
}

export const privateMusicBucket = createPrivateMusicBucket({
	bucket: HALFLIGHT_PRIVATE_MUSIC_BUCKET,
	endpoint: HALFLIGHT_PRIVATE_MUSIC_BUCKET_ENDPOINT,
	region: HALFLIGHT_PRIVATE_MUSIC_BUCKET_REGION,
	accessKeyId: HALFLIGHT_PRIVATE_MUSIC_BUCKET_ACCESS_KEY_ID,
	secretAccessKey: HALFLIGHT_PRIVATE_MUSIC_BUCKET_SECRET_ACCESS_KEY
});
