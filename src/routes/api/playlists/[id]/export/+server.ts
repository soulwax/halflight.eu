import { error, json, type RequestHandler } from '@sveltejs/kit';
import { exportBucket, type ExportFormat } from '#lib/server/export-bucket';
import { log } from '#lib/server/log';
import { getUserPlaylists } from '#lib/server/playlists';
import { generateM3u, sanitizeFileName, tidalApi } from '#lib/server/tidal';
import { normalisePlaylistDetail } from '#lib/server/tidal/normalise';
import type { TrackSummary } from '#lib/tidal/models';

interface PlaylistExport {
	content: string;
	contentType: string;
	fileName: string;
	format: ExportFormat;
}

async function buildPlaylistExport(
	event: Parameters<RequestHandler>[0],
	includeStreamLinks: boolean
): Promise<PlaylistExport> {
	const user = event.locals.user;
	if (!user) error(401, 'Unauthorized');
	const playlistId = event.params.id;
	if (!playlistId) error(400, 'Missing playlist ID');

	const url = new URL(event.request.url);
	const format = (url.searchParams.get('format') || 'm3u8').toLowerCase();
	if (format !== 'm3u8' && format !== 'json') error(400, 'Unsupported export format');

	let playlistTitle = 'Playlist';
	let tracks: TrackSummary[] = [];
	const userPlaylists = await getUserPlaylists(user.id);
	const localMatch = userPlaylists.find((playlist) => playlist.id === playlistId);

	if (localMatch) {
		playlistTitle = localMatch.title;
		tracks = localMatch.items || [];
	} else {
		try {
			const doc = await tidalApi.getPlaylist(
				playlistId,
				{ include: ['items'] },
				{ fetch: event.fetch, cookies: event.cookies }
			);
			let detail = normalisePlaylistDetail(doc);
			const expectedCount = detail?.numberOfItems ?? 0;
			if (detail && (detail.items.length === 0 || detail.items.length < expectedCount)) {
				const { items, included } = await tidalApi.getFullPlaylistItems(
					playlistId,
					{ fetch: event.fetch, cookies: event.cookies },
					{ include: ['artists', 'albums'] }
				);
				if (items.length > 0) {
					const relationships =
						(doc.data as { relationships?: Record<string, unknown> })?.relationships ?? {};
					detail =
						normalisePlaylistDetail({
							...doc,
							data: {
								...(doc.data as object),
								relationships: {
									...relationships,
									items: { ...((relationships.items as object) ?? {}), data: items }
								}
							},
							included: [
								...((doc as { included?: unknown[] }).included ?? []),
								...items,
								...included
							]
						}) ?? detail;
				}
			}
			if (detail) {
				playlistTitle = detail.title;
				tracks = detail.items || [];
			}
		} catch {
			// The same not-found response protects whether a remote playlist exists.
		}
	}

	if (!tracks.length && !localMatch) error(404, 'Playlist not found or contains no tracks');
	const safeTitle = sanitizeFileName(playlistTitle, 'syn_playlist');
	if (format === 'json') {
		return {
			content: JSON.stringify(
				{
					title: playlistTitle,
					exportedAt: new Date().toISOString(),
					trackCount: tracks.length,
					tracks
				},
				null,
				2
			),
			contentType: 'application/json; charset=utf-8',
			fileName: `${safeTitle}.json`,
			format: 'json'
		};
	}

	const baseUrl = includeStreamLinks ? `${url.protocol}//${url.host}` : undefined;
	return {
		content: generateM3u({ title: playlistTitle, tracks, baseUrl }),
		contentType: 'audio/x-mpegurl; charset=utf-8',
		fileName: `${safeTitle}.m3u8`,
		format: 'm3u8'
	};
}

/** Direct, no-retention export. This remains the default for ordinary downloads. */
export const GET: RequestHandler = async (event) => {
	const artifact = await buildPlaylistExport(
		event,
		new URL(event.request.url).searchParams.get('stream') === 'true'
	);
	return new Response(artifact.content, {
		status: 200,
		headers: {
			'Content-Type': artifact.contentType,
			'Content-Disposition': `attachment; filename="${artifact.fileName}"`,
			'Cache-Control': 'no-cache'
		}
	});
};

/** Stores an explicit owner export for a short hand-off window. */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	if (!exportBucket.enabled) error(503, 'Export storage is not configured');
	try {
		const artifact = await buildPlaylistExport(event, false);
		const stored = await exportBucket.put({
			userId: event.locals.user.id,
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
		log.warn('playlist export bucket write failed', { cause });
		error(503, 'Export storage is temporarily unavailable');
	}
};
