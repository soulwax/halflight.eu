/**
 * Wire contracts for Syn's self-hosted download and playback worker.
 *
 * These deliberately model Syn's worker API rather than streamrip's internal
 * Python objects. The worker is free to use streamrip as its implementation.
 */

export const WORKER_AUDIO_QUALITIES = ['LOW', 'HIGH', 'LOSSLESS', 'HI_RES_LOSSLESS'] as const;
export type WorkerAudioQuality = (typeof WORKER_AUDIO_QUALITIES)[number];

export const WORKER_DOWNLOAD_FORMATS = ['FLAC', 'ALAC', 'MP3', 'AAC', 'OPUS'] as const;
export type WorkerDownloadFormat = (typeof WORKER_DOWNLOAD_FORMATS)[number];

export const WORKER_JOB_STATES = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type WorkerJobState = (typeof WORKER_JOB_STATES)[number];

/** The worker's authenticated liveness response. */
export interface WorkerHealth {
	status: 'ok';
	version?: string;
}

/** A request to download one resource into the worker's durable media library. */
export interface CreateDownloadJobRequest {
	/** Syn's durable job id, used by the worker's credential lease. */
	jobId: string;
	/** TIDAL resource URL or stable resource ID understood by the worker. */
	resource: string;
	/** A quality request, subject to the connected account's entitlement. */
	quality: WorkerAudioQuality;
	/** Optional post-processing format; omit to preserve the source format. */
	format?: WorkerDownloadFormat;
}

/** Worker-owned, durable job state. Syn will mirror this in PostgreSQL. */
export interface WorkerDownloadJob {
	id: string;
	state: WorkerJobState;
	resource: string;
	quality: WorkerAudioQuality;
	format?: WorkerDownloadFormat;
	progress?: {
		completed: number;
		total: number;
	};
	/** A stable, non-sensitive failure classification, not a raw upstream message. */
	failureCode?: string;
	createdAt: string;
	updatedAt: string;
}

/** Requests a short-lived worker-owned browser playback ticket. */
export interface CreatePlaybackSessionRequest {
	/** Syn's durable audit/job id; the worker uses it only to acquire a one-job credential lease. */
	jobId: string;
	trackId: string;
	quality: WorkerAudioQuality;
	loudnessNormalization: boolean;
}

/**
 * A worker-issued browser URL with an opaque signed ticket. It is deliberately
 * short lived and must never be stored in Syn's database.
 */
export interface WorkerPlaybackSession {
	id: string;
	playbackUrl: string;
	mimeType?: string;
	fileExtension?: string;
	audioQuality?: WorkerAudioQuality;
	expiresAt: string;
}
