import { STREAMRIP_WORKER_TOKEN, STREAMRIP_WORKER_URL } from '$app/env/private';
import { WorkerClient, WorkerConfigError } from './index';

/** Return the configured worker client without exposing its credential to callers. */
export function getWorkerClient(fetchImpl?: typeof fetch): WorkerClient {
	if (!STREAMRIP_WORKER_URL || !STREAMRIP_WORKER_TOKEN) {
		throw new WorkerConfigError('The self-hosted media worker is not configured.');
	}
	return new WorkerClient({
		baseUrl: STREAMRIP_WORKER_URL,
		bearerToken: STREAMRIP_WORKER_TOKEN,
		fetch: fetchImpl
	});
}
