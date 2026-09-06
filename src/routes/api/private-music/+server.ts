import { error, json, type RequestHandler } from '@sveltejs/kit';
import { log } from '#lib/server/log';
import {
	dbPrivateMusicStore,
	MAX_PRIVATE_MUSIC_TOTAL_BYTES,
	parsePrivateMusicUpload
} from '#lib/server/private-music';
import { privateMusicBucket } from '#lib/server/private-music-bucket';

function requireOwner(event: Parameters<RequestHandler>[0]): string {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
	return event.locals.user.id;
}

export const GET: RequestHandler = async (event) => {
	const userId = requireOwner(event);
	const files = await dbPrivateMusicStore.list(userId);
	return json({
		files: files.map(({ id, fileName, contentType, sizeBytes, createdAt }) => ({
			id,
			fileName,
			contentType,
			sizeBytes,
			createdAt,
			downloadUrl: `/api/private-music/${id}`
		}))
	});
};

export const POST: RequestHandler = async (event) => {
	const userId = requireOwner(event);
	if (!privateMusicBucket.enabled) error(503, 'Private music storage is not configured');
	const upload = parsePrivateMusicUpload((await event.request.formData()).get('file'));
	if (!upload.success) error(400, `Invalid private music upload: ${upload.reason}`);

	const totalBytes = await dbPrivateMusicStore.totalBytes(userId);
	if (totalBytes + upload.file.size > MAX_PRIVATE_MUSIC_TOTAL_BYTES) {
		error(413, 'Private music storage limit reached');
	}

	const id = crypto.randomUUID();
	const objectKey = `halflight-private-music/v1/${id}`;
	try {
		await privateMusicBucket.put(
			objectKey,
			new Uint8Array(await upload.file.arrayBuffer()),
			upload.contentType
		);
		const stored = await dbPrivateMusicStore.create({
			id,
			userId,
			objectKey,
			fileName: upload.fileName,
			contentType: upload.contentType,
			sizeBytes: upload.file.size
		});
		return json(
			{
				id: stored.id,
				fileName: stored.fileName,
				contentType: stored.contentType,
				sizeBytes: stored.sizeBytes,
				downloadUrl: `/api/private-music/${stored.id}`
			},
			{ status: 201 }
		);
	} catch (cause) {
		await privateMusicBucket.delete(objectKey).catch(() => undefined);
		log.warn('private music upload failed', { cause });
		error(503, 'Private music storage is temporarily unavailable');
	}
};
