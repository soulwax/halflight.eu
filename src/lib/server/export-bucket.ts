import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import {
	HALFLIGHT_EXPORT_BUCKET,
	HALFLIGHT_EXPORT_BUCKET_ACCESS_KEY_ID,
	HALFLIGHT_EXPORT_BUCKET_ENDPOINT,
	HALFLIGHT_EXPORT_BUCKET_REGION,
	HALFLIGHT_EXPORT_BUCKET_SECRET_ACCESS_KEY
} from '$app/env/private';

const EXPORT_PREFIX = 'halflight-exports/v1/';
const EXPORT_TTL_MS = 15 * 60 * 1_000;
const ARTIFACT_ID = /^(?<expiresAt>\d{13})-(?<token>[0-9a-f-]{36})\.(?<format>json|m3u8)$/i;

export type ExportFormat = 'json' | 'm3u8';

export interface ExportBucketConfig {
	bucket?: string;
	endpoint?: string;
	region?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
}

interface BucketClient {
	send(command: unknown): Promise<unknown>;
}

interface ExportObjectBody {
	transformToWebStream?: () => ReadableStream<Uint8Array>;
}

export interface StoredExport {
	id: string;
	expiresAt: string;
	body: ReadableStream<Uint8Array>;
	contentType: string;
	contentDisposition: string;
}

export interface ExportBucket {
	readonly enabled: boolean;
	put(input: {
		content: Uint8Array;
		contentType: string;
		fileName: string;
		format: ExportFormat;
	}): Promise<{ id: string; expiresAt: string }>;
	get(id: string): Promise<StoredExport | null>;
	delete(id: string): Promise<boolean>;
}

function parseArtifactId(id: string): { expiresAt: number; format: ExportFormat } | null {
	const match = ARTIFACT_ID.exec(id);
	if (!match?.groups) return null;
	const expiresAt = Number(match.groups.expiresAt);
	const format = match.groups.format.toLowerCase();
	if (!Number.isSafeInteger(expiresAt) || (format !== 'json' && format !== 'm3u8')) return null;
	return { expiresAt, format };
}

function contentTypeFor(format: ExportFormat): string {
	return format === 'json' ? 'application/json; charset=utf-8' : 'audio/x-mpegurl; charset=utf-8';
}

function objectKey(id: string): string {
	return `${EXPORT_PREFIX}${id}`;
}

function isConfigured(config: ExportBucketConfig): config is Required<ExportBucketConfig> {
	if (!config.bucket || !config.endpoint || !config.accessKeyId || !config.secretAccessKey)
		return false;
	try {
		const endpoint = new URL(config.endpoint);
		return (
			(endpoint.protocol === 'https:' || endpoint.protocol === 'http:') &&
			Boolean(endpoint.hostname)
		);
	} catch {
		return false;
	}
}

const unavailableExportBucket: ExportBucket = {
	enabled: false,
	async put() {
		throw new Error('Export bucket is not configured.');
	},
	async get() {
		return null;
	},
	async delete() {
		return false;
	}
};

/**
 * Creates the server-only export bucket adapter. It accepts only opaque,
 * short-lived owner exports; there are no signed URLs or provider/media keys.
 */
export function createExportBucket(
	config: ExportBucketConfig,
	client?: BucketClient
): ExportBucket {
	if (!isConfigured(config)) return unavailableExportBucket;

	const bucketClient =
		client ??
		(new S3Client({
			region: config.region || 'auto',
			endpoint: config.endpoint,
			forcePathStyle: true,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey
			}
		}) as unknown as BucketClient);

	return {
		enabled: true,
		async put({ content, contentType, fileName, format }) {
			const expiresAt = Date.now() + EXPORT_TTL_MS;
			const id = `${expiresAt}-${crypto.randomUUID()}.${format}`;
			await bucketClient.send(
				new PutObjectCommand({
					Bucket: config.bucket,
					Key: objectKey(id),
					Body: content,
					ContentType: contentType,
					ContentDisposition: `attachment; filename="${fileName}"`,
					Metadata: { 'expires-at': String(expiresAt) }
				})
			);
			return { id, expiresAt: new Date(expiresAt).toISOString() };
		},
		async get(id) {
			const artifact = parseArtifactId(id);
			if (!artifact) return null;
			if (artifact.expiresAt <= Date.now()) {
				await bucketClient.send(
					new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey(id) })
				);
				return null;
			}

			const response = (await bucketClient.send(
				new GetObjectCommand({ Bucket: config.bucket, Key: objectKey(id) })
			)) as {
				Body?: ExportObjectBody;
				ContentType?: string;
				ContentDisposition?: string;
			};
			const body = response.Body?.transformToWebStream?.();
			if (!body) return null;
			return {
				id,
				expiresAt: new Date(artifact.expiresAt).toISOString(),
				body,
				contentType: response.ContentType ?? contentTypeFor(artifact.format),
				contentDisposition:
					response.ContentDisposition ?? `attachment; filename="export.${artifact.format}"`
			};
		},
		async delete(id) {
			if (!parseArtifactId(id)) return false;
			await bucketClient.send(
				new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey(id) })
			);
			return true;
		}
	};
}

export const exportBucket = createExportBucket({
	bucket: HALFLIGHT_EXPORT_BUCKET,
	endpoint: HALFLIGHT_EXPORT_BUCKET_ENDPOINT,
	region: HALFLIGHT_EXPORT_BUCKET_REGION,
	accessKeyId: HALFLIGHT_EXPORT_BUCKET_ACCESS_KEY_ID,
	secretAccessKey: HALFLIGHT_EXPORT_BUCKET_SECRET_ACCESS_KEY
});
