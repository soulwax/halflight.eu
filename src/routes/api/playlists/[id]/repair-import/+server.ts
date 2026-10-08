import { error, json, type RequestHandler } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { userPlaylist } from '#lib/server/db/schema';
import { getUserPlaylists } from '#lib/server/playlists';
import { getFullPlaylist, getTrack, search } from '#lib/server/tidal/api';
import {
	normalisePlaylistDetail,
	normaliseTrackDetail,
	normaliseSearchResults
} from '#lib/server/tidal/normalise';
import { playlistSourceVersion } from '#lib/server/playlists/sync';
import { createImportFetch } from '#lib/server/playlists/import-fetch';
import { getStreamingSettings } from '#lib/server/streaming-settings';
import { findVerifiedReplacements } from '#lib/server/playlists/recording-verification';
import { validatePlaylistPlayback } from '#lib/server/playlists/playback-validation';
import type { TrackSummary } from '#lib/tidal/models';
async function context(event: Parameters<RequestHandler>[0], sourceId: unknown) {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	if (typeof sourceId !== 'string' || !/^\d{1,20}$/.test(sourceId))
		error(400, 'Invalid source recording');
	const owner = event.locals.user.id;
	const playlist = (await getUserPlaylists(owner)).find((item) => item.id === event.params.id);
	if (!playlist?.tidalPlaylistId) error(404, 'Imported playlist not found');
	if (playlist.syncStatus !== 'synced') error(409, 'Playlist has local edits');
	const ctx = {
		fetch: createImportFetch(event.fetch),
		cookies: event.cookies,
		signal: event.request.signal
	};
	const document = await getFullPlaylist(
		playlist.tidalPlaylistId,
		{ include: ['artists', 'albums'] },
		ctx
	);
	if (!playlist.remoteEtag || playlist.remoteEtag !== playlistSourceVersion(document))
		error(409, 'TIDAL source changed; refresh the import');
	const sourcePlaylist = normalisePlaylistDetail(document);
	const source = sourcePlaylist?.items.find((track) => track.id === sourceId);
	if (!source || !sourcePlaylist) error(404, 'Source recording not found');
	if (playlist.items.some((track) => (track.replacementForId ?? track.id) === sourceId))
		error(409, 'Recording already imported');
	const quality = (await getStreamingSettings(owner)).preferredQuality;
	return { owner, playlist, ctx, source, sourcePlaylist, quality };
}
export const GET: RequestHandler = async (event) => {
	const data = await context(event, event.url.searchParams.get('sourceId'));
	const query = event.url.searchParams.get('q')?.trim();
	if (query && query.length > 200) error(400, 'Search is too long');
	const candidates = query
		? normaliseSearchResults(
				await search(
					query,
					{ types: ['tracks'], include: ['tracks.artists', 'tracks.albums'] },
					data.ctx
				)
			).tracks.slice(0, 12)
		: (await findVerifiedReplacements(data.source, data.owner, data.ctx, data.quality)).map(
				(candidate) => candidate.track
			);
	return json(
		{ source: data.source, candidates, version: data.playlist.updatedAt },
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	const body = await event.request.json().catch(() => null);
	if (
		!body ||
		typeof body.candidateId !== 'string' ||
		!/^\d{1,20}$/.test(body.candidateId) ||
		typeof body.version !== 'string'
	)
		error(400, 'Invalid repair');
	const data = await context(event, body.sourceId);
	if (data.playlist.updatedAt !== body.version) error(409, 'Playlist changed');
	const candidate = normaliseTrackDetail(
		await getTrack(body.candidateId, { include: ['artists', 'albums'] }, data.ctx)
	);
	if (!candidate || candidate.id !== body.candidateId) error(404, 'Candidate not found');
	if (
		!(await validatePlaylistPlayback([candidate], data.owner, data.ctx, data.quality, true)).length
	)
		error(409, 'Candidate cannot play');
	const bySource = new Map<string, TrackSummary[]>();
	for (const track of data.playlist.items) {
		const id = track.replacementForId ?? track.id;
		const entries = bySource.get(id) ?? [];
		entries.push(track);
		bySource.set(id, entries);
	}
	const items: TrackSummary[] = [];
	for (const source of data.sourcePlaylist.items) {
		if (source.id === data.source.id) items.push({ ...candidate, replacementForId: source.id });
		else {
			const entry = bySource.get(source.id)?.shift();
			if (entry) items.push(entry);
		}
	}
	const changed = await db
		.update(userPlaylist)
		.set({ itemsJson: JSON.stringify(items), updatedAt: new Date() })
		.where(
			and(
				eq(userPlaylist.userId, data.owner),
				eq(userPlaylist.id, data.playlist.id),
				eq(userPlaylist.itemsJson, JSON.stringify(data.playlist.items)),
				sql`date_trunc('milliseconds', ${userPlaylist.updatedAt}) = ${body.version}::timestamptz`,
				eq(userPlaylist.syncStatus, 'synced')
			)
		)
		.returning({ id: userPlaylist.id });
	if (!changed.length) error(409, 'Playlist changed');
	return json(
		{
			saved: true,
			restoredCount: data.sourcePlaylist.items.filter((track) => track.id === data.source.id).length
		},
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};
