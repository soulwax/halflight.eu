import { error, json, type RequestHandler } from '@sveltejs/kit';
import { log } from '#lib/server/log';
import { dbPrivateMusicStore } from '#lib/server/private-music';
import { privateMusicBucket } from '#lib/server/private-music-bucket';

function requireOwner(event: Parameters<RequestHandler>[0]): string {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
	return event.locals.user.id;
}

export const GET: RequestHandler = async (event) => {
	const userId = requireOwner(event);
	const file = await dbPrivateMusicStore.get(userId, event.params.id ?? '');
	if (!file) error(404, 'Private music file not found');
	try {
		const body = await privateMusicBucket.get(file.objectKey);
		if (!body) error(404, 'Private music file not found');
		return new Response(body, {
			headers: {
				'Content-Type': file.contentType,
				'Content-Length': String(file.sizeBytes),
				'Content-Disposition': `attachment; filename="${file.fileName}"`,
				'Cache-Control': 'private, no-store'
			}
		});
	} catch (cause) {
		log.warn('private music download failed', { cause });
		error(503, 'Private music storage is temporarily unavailable');
	}
};

export const DELETE: RequestHandler = async (event) => {
	const userId = requireOwner(event);
	const file = await dbPrivateMusicStore.get(userId, event.params.id ?? '');
	if (!file) error(404, 'Private music file not found');
	try {
		await privateMusicBucket.delete(file.objectKey);
		const deleted = await dbPrivateMusicStore.delete(userId, file.id);
		return json({ deleted: Boolean(deleted) });
	} catch (cause) {
		log.warn('private music deletion failed', { cause });
		error(503, 'Private music storage is temporarily unavailable');
	}
};
