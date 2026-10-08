import { error, json, type RequestHandler } from '@sveltejs/kit';
import { filterPlayableTracks, getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseSearchResults } from '#lib/server/tidal/normalise';
import { getListeningPreferences } from '#lib/server/listening-preferences';
import { getTasteProfile } from '#lib/server/taste/profile';
import { suggestAutoplayTracks, type KnownTrack } from '#lib/server/suggestions/autoplay';

const RADIO_INCLUDE = ['albums', 'artists'];
const MAX_SEEDS = 3;
const MAX_EXCLUDED = 300;
const noStore = { 'Cache-Control': 'private, no-store' };

function readKnown(value: unknown): KnownTrack | null {
	if (!value || typeof value !== 'object') return null;
	const raw = value as Record<string, unknown>;
	if (typeof raw.id !== 'string' || !/^\d{1,20}$/.test(raw.id)) return null;
	const text = (field: unknown) =>
		typeof field === 'string' && field.length <= 300 ? field : undefined;
	return { id: raw.id, title: text(raw.title), artist: text(raw.artist), isrc: text(raw.isrc) };
}

function readList(value: unknown, max: number): KnownTrack[] | null {
	if (!Array.isArray(value) || value.length > max) return null;
	const known = value.map(readKnown);
	return known.every(Boolean) ? (known as KnownTrack[]) : null;
}

/**
 * POST /api/suggestions/autoplay
 *
 * Songs to continue a session whose queue has run out. Body:
 * `{ seeds: KnownTrack[] (most recent first, ≤3), exclude: KnownTrack[] (≤300) }`.
 * The batch size and personalisation follow the listener's saved preferences.
 */
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user || !event.locals.isListener) error(401, 'Unauthorized');

	const body = (await event.request.json().catch(() => null)) as Record<string, unknown> | null;
	const seeds = readList(body?.seeds, MAX_SEEDS);
	const exclude = readList(body?.exclude ?? [], MAX_EXCLUDED);
	if (!seeds?.length || !exclude) error(400, 'Invalid autoplay request');

	const preferences = await getListeningPreferences(user.id);
	if (!preferences.autoplay)
		return json({ tracks: [], reason: 'autoplay_disabled' }, { headers: noStore });

	const connection = await getConnectionStatus();
	if (!connection.connected)
		return json({ tracks: [], error: 'not_connected' }, { status: 503, headers: noStore });

	const ctx = { fetch: event.fetch, cookies: event.cookies };
	const profile = preferences.personalizeSuggestions
		? await getTasteProfile(user.id).catch(() => undefined)
		: undefined;
	const tracks = await suggestAutoplayTracks(
		{ seeds, exclude, count: preferences.autoplayCount, profile },
		{
			radio: async (trackId) => {
				const document = await tidalApi
					.getTrackRelationship(trackId, 'radio', { include: RADIO_INCLUDE }, ctx)
					.catch(() =>
						tidalApi.getTrackRelationship(trackId, 'similarTracks', { include: RADIO_INCLUDE }, ctx)
					);
				return normaliseSearchResults(document).tracks;
			},
			playable: filterPlayableTracks
		}
	);
	return json({ tracks }, { headers: noStore });
};
