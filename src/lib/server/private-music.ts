import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { privateMusicFile } from '#lib/server/db/schema';

export const MAX_PRIVATE_MUSIC_FILE_BYTES = 128 * 1024 * 1024;
export const MAX_PRIVATE_MUSIC_TOTAL_BYTES = 512 * 1024 * 1024;

/**
 * The complete audio-upload contract. Keep the browser-facing `accept` value,
 * server validation, and stored Content-Type derived from this one registry so
 * an uploaded file is never advertised as a format Syn will refuse later.
 *
 * MIME types are client-provided metadata and vary by OS/browser, especially
 * for M4A and WAV. The aliases make the upload experience humane; the stored
 * type is always the canonical type below and downloads are still served with
 * `nosniff` from the authenticated proxy.
 */
export const PRIVATE_MUSIC_FORMATS = [
	{
		label: 'MP3',
		contentType: 'audio/mpeg',
		extensions: ['mp3'],
		mimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg']
	},
	{
		label: 'FLAC',
		contentType: 'audio/flac',
		extensions: ['flac'],
		mimeTypes: ['audio/flac', 'audio/x-flac']
	},
	{
		label: 'AAC',
		contentType: 'audio/aac',
		extensions: ['aac'],
		mimeTypes: ['audio/aac', 'audio/x-aac']
	},
	{
		label: 'M4A',
		contentType: 'audio/mp4',
		extensions: ['m4a', 'mp4'],
		mimeTypes: ['audio/mp4', 'audio/x-m4a']
	},
	{
		label: 'Ogg',
		contentType: 'audio/ogg',
		extensions: ['ogg', 'oga'],
		mimeTypes: ['audio/ogg', 'application/ogg']
	},
	{
		label: 'WAV',
		contentType: 'audio/wav',
		extensions: ['wav'],
		mimeTypes: ['audio/wav', 'audio/wave', 'audio/x-wav']
	},
	{
		label: 'WebM',
		contentType: 'audio/webm',
		extensions: ['webm'],
		mimeTypes: ['audio/webm']
	}
] as const;

export const PRIVATE_MUSIC_CONTENT_TYPES = new Set(
	PRIVATE_MUSIC_FORMATS.map((format) => format.contentType)
);
export const PRIVATE_MUSIC_ACCEPT = PRIVATE_MUSIC_FORMATS.flatMap((format) => [
	...format.mimeTypes,
	...format.extensions.map((extension) => `.${extension}`)
]).join(',');

export interface PrivateMusicFile {
	id: string;
	userId: string;
	objectKey: string;
	fileName: string;
	contentType: string;
	sizeBytes: number;
	createdAt: string;
}

export interface PrivateMusicStore {
	list(userId: string): Promise<PrivateMusicFile[]>;
	get(userId: string, id: string): Promise<PrivateMusicFile | null>;
	totalBytes(userId: string): Promise<number>;
	create(file: Omit<PrivateMusicFile, 'createdAt'>): Promise<PrivateMusicFile>;
	delete(userId: string, id: string): Promise<PrivateMusicFile | null>;
}

function fromRow(row: typeof privateMusicFile.$inferSelect): PrivateMusicFile {
	return {
		id: row.id,
		userId: row.userId,
		objectKey: row.objectKey,
		fileName: row.fileName,
		contentType: row.contentType,
		sizeBytes: row.sizeBytes,
		createdAt: row.createdAt.toISOString()
	};
}

export const dbPrivateMusicStore: PrivateMusicStore = {
	async list(userId) {
		const rows = await db
			.select()
			.from(privateMusicFile)
			.where(eq(privateMusicFile.userId, userId))
			.orderBy(desc(privateMusicFile.createdAt));
		return rows.map(fromRow);
	},
	async get(userId, id) {
		const rows = await db
			.select()
			.from(privateMusicFile)
			.where(and(eq(privateMusicFile.userId, userId), eq(privateMusicFile.id, id)))
			.limit(1);
		return rows[0] ? fromRow(rows[0]) : null;
	},
	async totalBytes(userId) {
		const rows = await db
			.select({ total: sql<number>`coalesce(sum(${privateMusicFile.sizeBytes}), 0)` })
			.from(privateMusicFile)
			.where(eq(privateMusicFile.userId, userId));
		return Number(rows[0]?.total ?? 0);
	},
	async create(file) {
		const rows = await db
			.insert(privateMusicFile)
			.values({
				id: file.id,
				userId: file.userId,
				objectKey: file.objectKey,
				fileName: file.fileName,
				contentType: file.contentType,
				sizeBytes: file.sizeBytes
			})
			.returning();
		if (!rows[0]) throw new Error('Private music file metadata was not created.');
		return fromRow(rows[0]);
	},
	async delete(userId, id) {
		const rows = await db
			.delete(privateMusicFile)
			.where(and(eq(privateMusicFile.userId, userId), eq(privateMusicFile.id, id)))
			.returning();
		return rows[0] ? fromRow(rows[0]) : null;
	}
};

export function parsePrivateMusicUpload(
	value: FormDataEntryValue | null
):
	| { success: true; file: File; fileName: string; contentType: string }
	| { success: false; reason: 'missing' | 'type' | 'size' | 'name' } {
	if (!(value instanceof File) || value.size === 0) return { success: false, reason: 'missing' };
	const contentType = privateMusicContentType(value);
	if (!contentType) return { success: false, reason: 'type' };
	if (value.size > MAX_PRIVATE_MUSIC_FILE_BYTES) return { success: false, reason: 'size' };
	const fileName = Array.from(value.name.trim())
		.map((character) =>
			character.codePointAt(0)! < 32 || ['/', '\\', '"'].includes(character) ? '_' : character
		)
		.join('')
		.slice(0, 180);
	if (!fileName) return { success: false, reason: 'name' };
	return { success: true, file: value, fileName, contentType };
}

/** Resolve browser MIME aliases and the safe filename extension to one stored media type. */
function privateMusicContentType(file: File): string | null {
	const declaredType = file.type.toLowerCase().split(';', 1)[0] ?? '';
	const extension = file.name.trim().split('.').at(-1)?.toLowerCase() ?? '';
	const declaredFormat = PRIVATE_MUSIC_FORMATS.find((format) =>
		format.mimeTypes.includes(declaredType as never)
	);
	const extensionFormat = PRIVATE_MUSIC_FORMATS.find((format) =>
		format.extensions.includes(extension as never)
	);

	// Browser MIME metadata is often blank for local files. A recognised file
	// suffix still selects a canonical type, but two recognised, contradictory
	// signals are rejected rather than storing a misleading media type.
	if (declaredFormat && extensionFormat && declaredFormat !== extensionFormat) return null;
	return declaredFormat?.contentType ?? extensionFormat?.contentType ?? null;
}
