/** Server-only client contract for Syn's self-hosted media worker. */
export { WorkerClient, type WorkerClientOptions } from './client';
export {
	WorkerApiError,
	WorkerAuthenticationError,
	WorkerConfigError,
	WorkerError,
	WorkerProtocolError,
	WorkerUnavailableError
} from './errors';
export {
	WORKER_AUDIO_QUALITIES,
	WORKER_DOWNLOAD_FORMATS,
	WORKER_JOB_STATES,
	type CreateDownloadJobRequest,
	type CreatePlaybackSessionRequest,
	type WorkerAudioQuality,
	type WorkerDownloadFormat,
	type WorkerDownloadJob,
	type WorkerHealth,
	type WorkerJobState,
	type WorkerPlaybackSession
} from './types';
