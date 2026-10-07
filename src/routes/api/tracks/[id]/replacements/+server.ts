import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getUserPlaylists } from '#lib/server/playlists';
import { getTrack } from '#lib/server/tidal/api';
import { normaliseTrackDetail } from '#lib/server/tidal/normalise';
import { TidalApiError } from '#lib/server/tidal/errors';
import { dbPlaybackStateStore } from '#lib/server/playback-state';
import { getStreamingSettings } from '#lib/server/streaming-settings';
import {
	findVerifiedReplacements,
	recordingMatchScore
} from '#lib/server/playlists/recording-verification';
import { validatePlaylistPlayback } from '#lib/server/playlists/playback-validation';
import { replaceSavedRecording } from '#lib/server/playlists/replace-recording';
import type { TrackSummary } from '#lib/tidal/models';

async function context(event: Parameters<RequestHandler>[0]) {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	const id = event.params.id;
	if (!id || !/^\d{1,20}$/.test(id)) error(400, 'Invalid recording ID');
	const owner = event.locals.user.id;
	const playlists = await getUserPlaylists(owner);
	const ctx = { fetch: event.fetch, cookies: event.cookies, signal: event.request.signal };
	let source: TrackSummary | null = null;
	try {
		source = normaliseTrackDetail(await getTrack(id, { include: ['artists', 'albums'] }, ctx));
	} catch (cause) {
		if (!(cause instanceof TidalApiError) || cause.status !== 404) throw cause;
	}

	let snapshot = playlists.flatMap((playlist) => playlist.items).find((track) => track.id === id);
	if (!source || !source.artists.length || !source.isrc) {
		if (!snapshot) {
			const state = await dbPlaybackStateStore.read(owner);
			snapshot =
				[state?.currentTrack, ...(state?.queue ?? []), ...(state?.history ?? [])].find(
					(track) => track?.id === id
				) ?? undefined;
		}
		if (snapshot)
			source = source
				? {
						...snapshot,
						...source,
						artists: source.artists.length ? source.artists : snapshot.artists,
						isrc: source.isrc ?? snapshot.isrc
					}
				: snapshot;
	}
	if (!source || source.id !== id) error(404, 'Recording metadata unavailable');
	const settings = await getStreamingSettings(owner);
	return { owner, id, source, playlists, ctx, quality: settings.preferredQuality };
}

export const GET: RequestHandler = async (event) => {
	const data = await context(event);
	const candidates = await findVerifiedReplacements(
		data.source,
		data.owner,
		data.ctx,
		data.quality
	);
	return json(
		{
			source: data.source,
			candidates,
			playlists: data.playlists
				.filter((playlist) => playlist.items.some((track) => track.id === data.id))
				.map(({ id, title, updatedAt }) => ({ id, title, version: updatedAt }))
		},
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	const body = (await event.request.json().catch(() => null)) as {
		candidateId?: unknown;
		playlistId?: unknown;
		version?: unknown;
	} | null;
	if (
		!body ||
		typeof body.candidateId !== 'string' ||
		!/^\d{1,20}$/.test(body.candidateId) ||
		(body.playlistId != null &&
			(typeof body.playlistId !== 'string' || typeof body.version !== 'string'))
	)
		error(400, 'Invalid replacement selection');
	const data = await context(event);
	const candidate = normaliseTrackDetail(
		await getTrack(body.candidateId, { include: ['artists', 'albums'] }, data.ctx)
	);
	if (
		!candidate ||
		candidate.id !== body.candidateId ||
		!recordingMatchScore(data.source, candidate)
	)
		error(400, 'Recording does not match');
	if (
		!(await validatePlaylistPlayback([candidate], data.owner, data.ctx, data.quality, true)).length
	)
		error(409, 'Replacement is no longer playable');
	if (body.playlistId) {
		const changed = await replaceSavedRecording(
			data.owner,
			body.playlistId as string,
			data.id,
			candidate,
			body.version as string
		);
		if (changed === 'missing') error(404, 'Playlist not found');
		if (changed === 'conflict') error(409, 'Playlist changed; refresh the suggestions');
	}
	return json(
		{ track: candidate, playlistUpdated: Boolean(body.playlistId) },
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};
