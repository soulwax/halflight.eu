import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getStreamripJob } from '#lib/server/streamrip-jobs';

/** Return the caller-owned durable job state; artifact URLs are worker-issued separately. */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Unauthorized');
	const id = event.params.id;
	if (!id) error(400, 'Download ID required');
	const job = await getStreamripJob(event.locals.user.id, id);
	if (!job || job.kind !== 'download') error(404, 'Download not found');
	return json({
		id: job.id,
		trackId: job.trackId,
		status: job.status,
		outputFormat: job.outputFormat,
		quality: job.requestedQuality,
		errorCode: job.errorCode,
		createdAt: job.createdAt,
		completedAt: job.completedAt
	});
};
