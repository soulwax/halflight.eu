import { exportBucket, type ExportFormat } from '#lib/server/export-bucket';
import { log } from '#lib/server/log';
import { dbPrivateMusicStore, type PrivateMusicFile } from '#lib/server/private-music';
import { error, json, type RequestHandler } from '@sveltejs/kit';

interface PrivateMusicExport {
	content: string;
	contentType: string;
	fileName: string;
	format: ExportFormat;
}

function requireOwner(event: Parameters<RequestHandler>[0]): string {
	if (!event.locals.user || !event.locals.isAdministrator) error(401, 'Unauthorized');
	return event.locals.user.id;
}

function buildM3u(files: PrivateMusicFile[], origin: string): string {
	const lines = ['#EXTM3U', '#PLAYLIST:Halflight private music'];
	for (const file of files) {
		lines.push(`#EXTINF:-1,${file.fileName}`);
		lines.push(`${origin}/api/private-music/${encodeURIComponent(file.id)}`);
	}
	return `${lines.join('\n')}\n`;
}

function buildExport(files: PrivateMusicFile[], requestUrl: string): PrivateMusicExport {
	const url = new URL(requestUrl);
	const format = (url.searchParams.get('format') ?? 'm3u8').toLowerCase();
	if (format !== 'm3u8' && format !== 'json') error(400, 'Unsupported export format');

	if (format === 'json') {
		return {
			content: JSON.stringify(
				{
					exportedAt: new Date().toISOString(),
					fileCount: files.length,
					files: files.map(({ id, fileName, contentType, sizeBytes, createdAt }) => ({
						id,
						fileName,
						contentType,
						sizeBytes,
						createdAt,
						downloadUrl: `/api/private-music/${id}`
					}))
				},
				null,
				2
			),
			contentType: 'application/json; charset=utf-8',
			fileName: 'syn-private-music.json',
			format
		};
	}

	return {
		content: buildM3u(files, url.origin),
		contentType: 'audio/x-mpegurl; charset=utf-8',
		fileName: 'syn-private-music.m3u8',
		format
	};
}

/** Direct, no-retention manifest export for the owner's private uploads. */
export const GET: RequestHandler = async (event) => {
	const files = await dbPrivateMusicStore.list(requireOwner(event));
	const artifact = buildExport(files, event.request.url);
	return new Response(artifact.content, {
		headers: {
			'Content-Type': artifact.contentType,
			'Content-Disposition': `attachment; filename="${artifact.fileName}"`,
			'Cache-Control': 'private, no-store'
		}
	});
};

/** Creates an explicit, short-lived hand-off copy of an owner manifest. */
export const POST: RequestHandler = async (event) => {
	const userId = requireOwner(event);
	if (!exportBucket.enabled) error(503, 'Export storage is not configured');
	try {
		const artifact = buildExport(await dbPrivateMusicStore.list(userId), event.request.url);
		const stored = await exportBucket.put({
			content: new TextEncoder().encode(artifact.content),
			contentType: artifact.contentType,
			fileName: artifact.fileName,
			format: artifact.format
		});
		return json(
			{ id: stored.id, expiresAt: stored.expiresAt, downloadUrl: `/api/exports/${stored.id}` },
			{ status: 201 }
		);
	} catch (cause) {
		log.warn('private music manifest bucket write failed', { cause });
		error(503, 'Export storage is temporarily unavailable');
	}
};
