import { error, json, type RequestHandler } from '@sveltejs/kit';
import { log } from '#lib/server/log';
import { dbPrivateMusicStore } from '#lib/server/private-music';
import { privateMusicBucket } from '#lib/server/private-music-bucket';
import { parseByteRange } from '#lib/server/tidal/segmented';
import { entityTag, matchesEntityTag, rangeIsUsable } from '#lib/server/http-range';

function requireOwner(event: Parameters<RequestHandler>[0]): string {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
	return event.locals.user.id;
}

interface DownloadFile {
	id: string;
	contentType: string;
	fileName: string;
	sizeBytes: number;
	createdAt: string;
}

function fileTag(file: DownloadFile): string {
	return entityTag(file.id, file.sizeBytes, Date.parse(file.createdAt));
}

function responseHeaders(file: DownloadFile, range?: { start: number; end: number }): Headers {
	const headers = new Headers({
		'Content-Type': file.contentType,
		'Content-Disposition': `attachment; filename="${file.fileName}"`,
		'Cache-Control': 'private, no-store',
		'Accept-Ranges': 'bytes',
		'X-Content-Type-Options': 'nosniff',
		Vary: 'Range',
		ETag: fileTag(file),
		'Last-Modified': new Date(file.createdAt).toUTCString()
	});

	if (range) {
		headers.set('Content-Length', String(range.end - range.start + 1));
		headers.set('Content-Range', `bytes ${range.start}-${range.end}/${file.sizeBytes}`);
	} else {
		headers.set('Content-Length', String(file.sizeBytes));
	}

	return headers;
}

export const GET: RequestHandler = async (event) => {
	const userId = requireOwner(event);
	const file = await dbPrivateMusicStore.get(userId, event.params.id ?? '');
	if (!file) error(404, 'Private music file not found');
	const tag = fileTag(file);
	if (matchesEntityTag(event.request.headers.get('if-none-match'), tag)) {
		return new Response(null, { status: 304, headers: responseHeaders(file) });
	}
	const rangeHeader = event.request.headers.get('range');
	const canUseRange = rangeIsUsable(event.request, tag);
	const range = canUseRange ? parseByteRange(rangeHeader, file.sizeBytes) : null;
	if (canUseRange && !range) {
		return new Response(null, {
			status: 416,
			headers: {
				'Content-Range': `bytes */${file.sizeBytes}`,
				'Accept-Ranges': 'bytes',
				'Cache-Control': 'private, no-store',
				Vary: 'Range'
			}
		});
	}
	try {
		const body = await privateMusicBucket.get(
			file.objectKey,
			range ? `bytes=${range.start}-${range.end}` : undefined
		);
		if (!body) error(404, 'Private music file not found');
		return new Response(body, {
			status: range ? 206 : 200,
			headers: responseHeaders(file, range ?? undefined)
		});
	} catch (cause) {
		log.warn('private music download failed', { cause });
		error(503, 'Private music storage is temporarily unavailable');
	}
};

export const HEAD: RequestHandler = async (event) => {
	const userId = requireOwner(event);
	const file = await dbPrivateMusicStore.get(userId, event.params.id ?? '');
	if (!file) error(404, 'Private music file not found');
	if (matchesEntityTag(event.request.headers.get('if-none-match'), fileTag(file))) {
		return new Response(null, { status: 304, headers: responseHeaders(file) });
	}
	return new Response(null, { headers: responseHeaders(file) });
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
