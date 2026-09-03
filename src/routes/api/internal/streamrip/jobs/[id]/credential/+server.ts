import { createHash, timingSafeEqual } from 'node:crypto';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { STREAMRIP_WORKER_TOKEN } from '$app/env/private';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { streamripJob } from '#lib/server/db/schema';
import { getPlaybackToken } from '#lib/server/tidal';

function hasWorkerCredential(supplied: string | null): boolean {
	if (!STREAMRIP_WORKER_TOKEN || !supplied) return false;
	const expectedDigest = createHash('sha256').update(STREAMRIP_WORKER_TOKEN).digest();
	const suppliedDigest = createHash('sha256').update(supplied).digest();
	return timingSafeEqual(expectedDigest, suppliedDigest);
}

/**
 * One-job, no-store credential lease for the private worker. It is intentionally
 * inaccessible to browsers and never records the returned bearer token.
 */
export const POST: RequestHandler = async (event) => {
	const supplied = event.request.headers.get('x-syn-worker-token');
	if (!hasWorkerCredential(supplied)) error(401, 'Unauthorized');

	const jobId = event.params.id;
	if (!jobId) error(400, 'Job ID required');
	const [job] = await db
		.select({
			kind: streamripJob.kind,
			status: streamripJob.status,
			expiresAt: streamripJob.expiresAt
		})
		.from(streamripJob)
		.where(eq(streamripJob.id, jobId))
		.limit(1);
	if (!job || job.kind !== 'playback' || job.status === 'failed') error(404, 'Job not available');
	if (job.expiresAt && job.expiresAt.getTime() < Date.now()) error(410, 'Job expired');

	const accessToken = await getPlaybackToken({ fetch: event.fetch });
	return json({ accessToken }, { headers: { 'cache-control': 'no-store', pragma: 'no-cache' } });
};
