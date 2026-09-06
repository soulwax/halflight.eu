import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { privateMusicFile } from '#lib/server/db/schema';

export const MAX_PRIVATE_MUSIC_FILE_BYTES = 128 * 1024 * 1024;
export const MAX_PRIVATE_MUSIC_TOTAL_BYTES = 512 * 1024 * 1024;
export const PRIVATE_MUSIC_CONTENT_TYPES = new Set([
	'audio/aac',
	'audio/flac',
	'audio/mp4',
	'audio/mpeg',
	'audio/ogg',
	'audio/wav',
	'audio/webm'
]);

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
	if (!PRIVATE_MUSIC_CONTENT_TYPES.has(value.type)) return { success: false, reason: 'type' };
	if (value.size > MAX_PRIVATE_MUSIC_FILE_BYTES) return { success: false, reason: 'size' };
	const fileName = Array.from(value.name.trim())
		.map((character) =>
			character.codePointAt(0)! < 32 || ['/', '\\', '"'].includes(character) ? '_' : character
		)
		.join('')
		.slice(0, 180);
	if (!fileName) return { success: false, reason: 'name' };
	return { success: true, file: value, fileName, contentType: value.type };
}
