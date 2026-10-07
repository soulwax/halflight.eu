import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { tasteListeningEvidence } from '#lib/server/db/schema';
import { emptyListeningEvidence, type ListeningEvidence } from '#lib/taste/listening-profile';
export async function readListeningEvidence(userId: string): Promise<ListeningEvidence> {
	const [row] = await db
		.select()
		.from(tasteListeningEvidence)
		.where(eq(tasteListeningEvidence.userId, userId))
		.limit(1);
	return row ? (row.data as ListeningEvidence) : emptyListeningEvidence();
}
export async function mutateListeningEvidence(
	userId: string,
	update: (state: ListeningEvidence) => ListeningEvidence
): Promise<void> {
	await db.transaction(async (tx) => {
		await tx
			.insert(tasteListeningEvidence)
			.values({ userId, data: emptyListeningEvidence() })
			.onConflictDoNothing();
		const [row] = await tx
			.select()
			.from(tasteListeningEvidence)
			.where(eq(tasteListeningEvidence.userId, userId))
			.for('update');
		await tx
			.update(tasteListeningEvidence)
			.set({ data: update(row.data as ListeningEvidence), updatedAt: new Date() })
			.where(eq(tasteListeningEvidence.userId, userId));
	});
}
export async function clearListeningEvidence(userId: string): Promise<void> {
	await db.delete(tasteListeningEvidence).where(eq(tasteListeningEvidence.userId, userId));
}
