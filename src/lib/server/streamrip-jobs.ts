import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { streamripJob } from '#lib/server/db/schema';
import { getWorkerClient } from '#lib/server/worker/config';
import type {
	WorkerAudioQuality,
	WorkerDownloadFormat,
	WorkerPlaybackSession
} from '#lib/server/worker';

export type StreamripQuality = Extract<WorkerAudioQuality, 'LOW' | 'HIGH' | 'LOSSLESS'>;
export type StreamripOutputFormat = 'source' | 'flac' | 'aac' | 'mp3' | 'opus';

export interface PlaybackJobResult {
	jobId: string;
	session: WorkerPlaybackSession;
}

function safeWorkerErrorCode(error: unknown): string {
	if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string') {
		return error.name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'worker_error';
	}
	return 'worker_error';
}

/**
 * Create a durable audit record, then request a browser-only, expiring media URL
 * from the worker. The URL/ticket is deliberately returned only in memory.
 */
export async function createPlaybackJob(
	userId: string,
	trackId: string,
	quality: StreamripQuality,
	loudnessNormalization: boolean,
	fetchImpl?: typeof fetch
): Promise<PlaybackJobResult> {
	const id = randomUUID();
	await db.insert(streamripJob).values({
		id,
		userId,
		trackId,
		kind: 'playback',
		status: 'preparing',
		requestedQuality: quality,
		outputFormat: 'source'
	});

	try {
		const session = await getWorkerClient(fetchImpl).createPlaybackSession({
			jobId: id,
			trackId,
			quality,
			loudnessNormalization
		});
		await db
			.update(streamripJob)
			.set({
				status: 'ready',
				workerJobId: session.id,
				audioQuality: session.audioQuality,
				mimeType: session.mimeType,
				fileExtension: session.fileExtension,
				expiresAt: new Date(session.expiresAt),
				updatedAt: new Date()
			})
			.where(eq(streamripJob.id, id));
		return { jobId: id, session };
	} catch (error) {
		await db
			.update(streamripJob)
			.set({ status: 'failed', errorCode: safeWorkerErrorCode(error), updatedAt: new Date() })
			.where(eq(streamripJob.id, id));
		throw error;
	}
}

/** Queue a durable conversion/download task. It can later be reconciled from the worker status API. */
export async function createDownloadJob(
	userId: string,
	trackId: string,
	quality: StreamripQuality,
	outputFormat: StreamripOutputFormat,
	fetchImpl?: typeof fetch
): Promise<{ id: string; workerJobId: string }> {
	const id = randomUUID();
	await db.insert(streamripJob).values({
		id,
		userId,
		trackId,
		kind: 'download',
		status: 'queued',
		requestedQuality: quality,
		outputFormat
	});
	try {
		const format =
			outputFormat === 'source' ? undefined : (outputFormat.toUpperCase() as WorkerDownloadFormat);
		const job = await getWorkerClient(fetchImpl).createDownloadJob({
			jobId: id,
			resource: trackId,
			quality,
			format
		});
		await db
			.update(streamripJob)
			.set({
				workerJobId: job.id,
				status: job.state === 'FAILED' ? 'failed' : 'queued',
				updatedAt: new Date()
			})
			.where(eq(streamripJob.id, id));
		return { id, workerJobId: job.id };
	} catch (error) {
		await db
			.update(streamripJob)
			.set({ status: 'failed', errorCode: safeWorkerErrorCode(error), updatedAt: new Date() })
			.where(eq(streamripJob.id, id));
		throw error;
	}
}

/** A caller-owned job lookup; raw worker tickets and provider values are never returned. */
export async function getStreamripJob(userId: string, id: string) {
	const [job] = await db
		.select()
		.from(streamripJob)
		.where(and(eq(streamripJob.userId, userId), eq(streamripJob.id, id)))
		.limit(1);
	return job ?? null;
}
