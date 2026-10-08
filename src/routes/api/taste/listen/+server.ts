import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { getTrack } from '#lib/server/tidal/api';
import { normaliseTrackDetail } from '#lib/server/tidal/normalise';
import { applyQualifiedListen } from '#lib/taste/listening-profile';
import { mutateListeningEvidence } from '#lib/server/taste/listening-store';
import { genresForPlayedTrack } from '#lib/server/taste/lastfm-listening';
import { getListeningPreferences } from '#lib/server/listening-preferences';
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	const body = await event.request.json().catch(() => null);
	if (
		!body ||
		typeof body.eventId !== 'string' ||
		!/^[a-zA-Z0-9_-]{1,128}$/.test(body.eventId) ||
		typeof body.trackId !== 'string' ||
		!/^\d{1,20}$/.test(body.trackId) ||
		!Number.isFinite(body.listenedSeconds) ||
		body.listenedSeconds <= 30 ||
		body.listenedSeconds > 86400 ||
		!Number.isFinite(body.observedAt) ||
		body.observedAt < Date.now() - 15 * 60_000 ||
		body.observedAt > Date.now() + 60_000
	)
		error(400, 'Invalid qualified listen');
	// Opted out: acknowledge without reading metadata or storing anything.
	if (!(await getListeningPreferences(event.locals.user.id)).learnFromListening)
		return json(
			{ accepted: false, reason: 'learning_disabled' },
			{ headers: { 'Cache-Control': 'private, no-store' } }
		);
	const track = normaliseTrackDetail(
		await getTrack(
			body.trackId,
			{ include: ['artists', 'albums'] },
			{ fetch: event.fetch, cookies: event.cookies }
		)
	);
	if (!track || track.id !== body.trackId) error(404, 'Recording metadata unavailable');
	const genres = track.artists[0]?.name
		? await genresForPlayedTrack(event.locals.user.id, track.artists[0].name, track.title)
		: [];
	let accepted = false;
	await mutateListeningEvidence(event.locals.user.id, (state) => {
		const result = applyQualifiedListen(state, {
			receipt: createHash('sha256').update(body.eventId).digest('hex'),
			listenedSeconds: body.listenedSeconds,
			artistIds: track.artists.map((artist) => artist.id),
			genres
		});
		accepted = result.accepted;
		return result.state;
	});
	return json({ accepted }, { headers: { 'Cache-Control': 'private, no-store' } });
};
