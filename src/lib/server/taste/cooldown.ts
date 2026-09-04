import { and, asc, eq, gt, inArray, lte } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { generationCooldown } from '#lib/server/db/schema';
import { log } from '#lib/server/log';

export const MAX_GENERATION_COOLDOWN_TRACKS = 500;
export const MAX_GENERATION_ACCEPTED_TRACKS = 100;
export const GENERATION_COOLDOWN_DAYS = 30;

export interface GenerationCooldownStore {
	read(userId: string, now: Date): Promise<string[]>;
	write(userId: string, trackIds: string[], expiresAt: Date, now: Date): Promise<void>;
}

function validTrackId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

export function normaliseGenerationCooldownTrackIds(trackIds: Iterable<unknown>): string[] {
	const unique = new Set<string>();
	for (const trackId of trackIds) {
		if (!validTrackId(trackId)) continue;
		unique.add(trackId);
		if (unique.size === MAX_GENERATION_ACCEPTED_TRACKS) break;
	}
	return [...unique];
}

function expiryFrom(now: Date): Date {
	const expiresAt = new Date(now);
	expiresAt.setUTCDate(expiresAt.getUTCDate() + GENERATION_COOLDOWN_DAYS);
	return expiresAt;
}

export const dbGenerationCooldownStore: GenerationCooldownStore = {
	async read(userId, now) {
		const rows = await db
			.select({ trackId: generationCooldown.trackId })
			.from(generationCooldown)
			.where(and(eq(generationCooldown.userId, userId), gt(generationCooldown.expiresAt, now)))
			.orderBy(asc(generationCooldown.expiresAt), asc(generationCooldown.trackId))
			.limit(MAX_GENERATION_COOLDOWN_TRACKS);
		return rows.map((row) => row.trackId);
	},
	async write(userId, trackIds, expiresAt, now) {
		if (trackIds.length === 0) return;
		await db.transaction(async (tx) => {
			await tx
				.delete(generationCooldown)
				.where(and(eq(generationCooldown.userId, userId), lte(generationCooldown.expiresAt, now)));
			await tx
				.insert(generationCooldown)
				.values(trackIds.map((trackId) => ({ userId, trackId, expiresAt })))
				.onConflictDoUpdate({
					target: [generationCooldown.userId, generationCooldown.trackId],
					set: { expiresAt }
				});
			const overflow = await tx
				.select({ trackId: generationCooldown.trackId })
				.from(generationCooldown)
				.where(and(eq(generationCooldown.userId, userId), gt(generationCooldown.expiresAt, now)))
				.orderBy(asc(generationCooldown.expiresAt), asc(generationCooldown.trackId))
				.offset(MAX_GENERATION_COOLDOWN_TRACKS);
			if (overflow.length > 0) {
				await tx.delete(generationCooldown).where(
					and(
						eq(generationCooldown.userId, userId),
						inArray(
							generationCooldown.trackId,
							overflow.map((row) => row.trackId)
						)
					)
				);
			}
		});
	}
};

export async function getGenerationCooldownTrackIds(
	userId: string,
	store: GenerationCooldownStore = dbGenerationCooldownStore,
	now = new Date()
): Promise<Set<string>> {
	try {
		return new Set(await store.read(userId, now));
	} catch (cause) {
		log.error('generation cooldown read failed, continuing without suppression', { cause });
		return new Set();
	}
}

export async function recordGenerationCooldown(
	userId: string,
	trackIds: Iterable<unknown>,
	store: GenerationCooldownStore = dbGenerationCooldownStore,
	now = new Date()
): Promise<void> {
	const validTrackIds = normaliseGenerationCooldownTrackIds(trackIds);
	if (validTrackIds.length === 0) return;
	await store.write(userId, validTrackIds, expiryFrom(now), now);
}
