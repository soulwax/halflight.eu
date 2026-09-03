import { error, type RequestHandler } from '@sveltejs/kit';
import { getUserPlaylists } from '#lib/server/playlists';
import { generateM3u, sanitizeFileName, tidalApi } from '#lib/server/tidal';
import { normalisePlaylistDetail } from '#lib/server/tidal/normalise';
import type { TrackSummary } from '#lib/tidal/models';

export const GET: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const playlistId = event.params.id;
	if (!playlistId) {
		throw error(400, 'Missing playlist ID');
	}

	const url = new URL(event.request.url);
	const format = (url.searchParams.get('format') || 'm3u8').toLowerCase();
	const streamLinks = url.searchParams.get('stream') === 'true';

	let playlistTitle = 'Playlist';
	let tracks: TrackSummary[] = [];

	// 1. Check if it's one of user's saved account playlists
	const userPlaylists = await getUserPlaylists(user.id);
	const localMatch = userPlaylists.find((p) => p.id === playlistId);

	if (localMatch) {
		playlistTitle = localMatch.title;
		tracks = localMatch.items || [];
	} else {
		// 2. Try fetching as a TIDAL playlist
		try {
			const doc = await tidalApi.getPlaylist(
				playlistId,
				{ include: ['items'] },
				{ fetch: event.fetch, cookies: event.cookies }
			);
			const detail = normalisePlaylistDetail(doc);
			if (detail) {
				playlistTitle = detail.title;
				tracks = detail.items || [];
			}
		} catch {
			// Not found
		}
	}

	if (!tracks.length && !localMatch) {
		throw error(404, 'Playlist not found or contains no tracks');
	}

	const safeTitle = sanitizeFileName(playlistTitle, 'syn_playlist');

	if (format === 'json') {
		const jsonContent = JSON.stringify(
			{
				title: playlistTitle,
				exportedAt: new Date().toISOString(),
				trackCount: tracks.length,
				tracks
			},
			null,
			2
		);

		return new Response(jsonContent, {
			status: 200,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Content-Disposition': `attachment; filename="${safeTitle}.json"`,
				'Cache-Control': 'no-cache'
			}
		});
	}

	// Default: M3U8
	const baseUrl = streamLinks ? `${url.protocol}//${url.host}` : undefined;
	const m3uContent = generateM3u({
		title: playlistTitle,
		tracks,
		baseUrl
	});

	return new Response(m3uContent, {
		status: 200,
		headers: {
			'Content-Type': 'audio/x-mpegurl; charset=utf-8',
			'Content-Disposition': `attachment; filename="${safeTitle}.m3u8"`,
			'Cache-Control': 'no-cache'
		}
	});
};
