import { error, json, type RequestHandler } from '@sveltejs/kit';
import { exportBucket } from '#lib/server/export-bucket';
import { log } from '#lib/server/log';

function requireOwner(event: Parameters<RequestHandler>[0]): string {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	return event.locals.user.id;
}

export const GET: RequestHandler = async (event) => {
	const userId = requireOwner(event);
	try {
		const artifact = await exportBucket.get(userId, event.params.id ?? '');
		if (!artifact) error(404, 'Export not found or expired');
		return new Response(artifact.body, {
			headers: {
				'Content-Type': artifact.contentType,
				'Content-Disposition': artifact.contentDisposition,
				'Cache-Control': 'no-store'
			}
		});
	} catch (cause) {
		log.warn('export bucket read failed', { cause });
		error(503, 'Export storage is temporarily unavailable');
	}
};

export const DELETE: RequestHandler = async (event) => {
	const userId = requireOwner(event);
	try {
		return json({ deleted: await exportBucket.delete(userId, event.params.id ?? '') });
	} catch (cause) {
		log.warn('export bucket delete failed', { cause });
		error(503, 'Export storage is temporarily unavailable');
	}
};
