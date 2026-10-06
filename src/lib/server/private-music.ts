import { and, desc, eq, sql } from 'drizzle-orm';
import { AUDIO_ACCEPT, AUDIO_FORMATS, analyzeAudio, AudioMetadataError } from 'bragi-audio';
import { db } from '#lib/server/db';
import { privateMusicFile } from '#lib/server/db/schema';

export const MAX_PRIVATE_MUSIC_FILE_BYTES = 128 * 1024 * 1024;
export const MAX_PRIVATE_MUSIC_TOTAL_BYTES = 512 * 1024 * 1024;

/**
 * The browser-facing format choices and server-side byte inspection derive from
 * bragi-audio. Filename and MIME metadata remain only untrusted hints; the actual
 * stored type is detected from the audio bytes before bucket persistence.
 */
export const PRIVATE_MUSIC_FORMATS = AUDIO_FORMATS;

export const PRIVATE_MUSIC_CONTENT_TYPES = new Set(
	PRIVATE_MUSIC_FORMATS.map((format) => format.contentType)
);
export const PRIVATE_MUSIC_ACCEPT = AUDIO_ACCEPT;

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

export interface PrivateMusicUpload {
	file: File;
	fileName: string;
}

export type PrivateMusicInspection =
	{ success: true; bytes: Uint8Array; contentType: string } | { success: false; reason: 'type' };

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
	| { success: true; upload: PrivateMusicUpload }
	| { success: false; reason: 'missing' | 'size' | 'name' } {
	if (!(value instanceof File) || value.size === 0) return { success: false, reason: 'missing' };
	if (value.size > MAX_PRIVATE_MUSIC_FILE_BYTES) return { success: false, reason: 'size' };
	const fileName = Array.from(value.name.trim())
		.map((character) =>
			character.codePointAt(0)! < 32 || ['/', '\\', '"'].includes(character) ? '_' : character
		)
		.join('')
		.slice(0, 180);
	if (!fileName) return { success: false, reason: 'name' };
	return { success: true, upload: { file: value, fileName } };
}

/** Inspect a bounded upload once, retaining the bytes for the subsequent bucket write. */
export async function inspectPrivateMusicUpload(
	upload: PrivateMusicUpload
): Promise<PrivateMusicInspection> {
	const bytes = new Uint8Array(await upload.file.arrayBuffer());
	try {
		const analysis = await analyzeAudio(
			bytes,
			{
				fileName: upload.fileName,
				mimeType: upload.file.type,
				size: upload.file.size
			},
			{
				maxFileBytes: MAX_PRIVATE_MUSIC_FILE_BYTES,
				strictHints: true,
				includeArtwork: false,
				duration: true
			}
		);
		return { success: true, bytes, contentType: analysis.format.contentType };
	} catch (cause) {
		if (cause instanceof AudioMetadataError) return { success: false, reason: 'type' };
		throw cause;
	}
}
