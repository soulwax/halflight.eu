import { weightedRecentSongs, type RecentSong } from '#lib/taste/recent-songs';
import { getListeningPreferences } from '#lib/server/listening-preferences';
import { createHash } from 'node:crypto';
import { LASTFM_API_KEY } from '$app/env/private';
import { getLastfmConnection } from '#lib/server/lastfm';
import { tidalApi, type TidalRequestContext } from '#lib/server/tidal';
import { normaliseSearchResults } from '#lib/server/tidal/normalise';
import type { GenreEvidence, ListeningEvidence } from '#lib/taste/listening-profile';
const GENRES = new Set(
	'rock,pop,alternative,indie,indie-rock,indie-pop,electronic,electronica,ambient,techno,house,deep-house,progressive-house,trance,dubstep,drum-and-bass,downtempo,trip-hop,synth-pop,new-wave,post-punk,punk,post-rock,shoegaze,dream-pop,experimental,industrial,metal,heavy-metal,black-metal,death-metal,folk,country,blues,soul,funk,rnb,hip-hop,rap,trap,jazz,classical,reggae,dub,disco,psychedelic,psychedelic-rock,progressive-rock,grunge,garage-rock,art-rock,world,latin,k-pop,j-pop,afrobeat'.split(
		','
	)
);
const ALIASES: Record<string, string> = {
	'hip hop': 'hip-hop',
	hiphop: 'hip-hop',
	'r&b': 'rnb',
	'rhythm and blues': 'rnb',
	'indie rock': 'indie-rock',
	'indie pop': 'indie-pop',
	'trip hop': 'trip-hop',
	'drum and bass': 'drum-and-bass',
	synthpop: 'synth-pop',
	'post punk': 'post-punk',
	'dream pop': 'dream-pop'
};
export function normalizeArtistName(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}
export function parseGenreTags(value: unknown): GenreEvidence[] {
	if (!Array.isArray(value)) return [];
	const tags = new Map<string, number>();
	for (const raw of value) {
		if (!raw || typeof raw.name !== 'string') continue;
		const name = raw.name.toLowerCase().trim();
		const key = ALIASES[name] ?? name.replaceAll(' ', '-');
		const weight = Number(raw.count);
		if (GENRES.has(key) && Number.isFinite(weight) && weight >= 10)
			tags.set(key, Math.max(tags.get(key) ?? 0, weight));
	}
	return [...tags]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([name, weight]) => ({ name, weight }));
}
interface LastfmResponse {
	error?: unknown;
	toptags?: { tag?: unknown };
	recenttracks?: {
		track?: Array<{
			artist?: { '#text'?: string; name?: string };
			name?: string;
			mbid?: string;
			date?: { uts?: string };
			'@attr'?: { nowplaying?: string };
		}>;
	};
}
async function read(
	method: string,
	params: Record<string, string>,
	fetchImpl: typeof fetch
): Promise<LastfmResponse> {
	const query = new URLSearchParams({
		method,
		...params,
		api_key: LASTFM_API_KEY ?? '',
		format: 'json'
	});
	const response = await fetchImpl(`https://ws.audioscrobbler.com/2.0/?${query}`, {
		signal: AbortSignal.timeout(8_000)
	});
	const body = await response.json();
	if (!response.ok || body.error) throw new Error('Last.fm taste lookup unavailable');
	return body;
}
const tagCache = new Map<string, { tags: GenreEvidence[]; expiresAt: number }>();
async function tags(
	artist: string,
	track: string | undefined,
	fetchImpl: typeof fetch
): Promise<GenreEvidence[]> {
	const key = createHash('sha256')
		.update(JSON.stringify([artist, track]))
		.digest('hex');
	const cached = tagCache.get(key);
	if (cached && cached.expiresAt > Date.now()) return cached.tags;
	const body = await read(
		track ? 'track.getTopTags' : 'artist.getTopTags',
		{ artist, ...(track ? { track } : {}), autocorrect: '1' },
		fetchImpl
	);
	const parsed = parseGenreTags(body.toptags?.tag);
	if (tagCache.size >= 256) tagCache.delete(tagCache.keys().next().value!);
	tagCache.set(key, { tags: parsed, expiresAt: Date.now() + 60 * 60_000 });
	return parsed;
}
export async function genresForPlayedTrack(
	userId: string,
	artist: string,
	track: string
): Promise<GenreEvidence[]> {
	if (!LASTFM_API_KEY || !(await getListeningPreferences(userId)).useLastfmHistory) return [];
	if (!(await getLastfmConnection(userId)).connected) return [];
	try {
		const specific = await tags(artist, track, fetch);
		return specific.length ? specific : await tags(artist, undefined, fetch);
	} catch {
		return [];
	}
}
/** Last.fm is a scrobble prior, never proof of the app's 30-second listen threshold. */
export async function readLastfmTastePrior(
	userId: string,
	ctx?: TidalRequestContext
): Promise<ListeningEvidence['lastfm'] | null> {
	if (!LASTFM_API_KEY || !(await getListeningPreferences(userId)).useLastfmHistory) return null;
	const connection = await getLastfmConnection(userId);
	if (!connection.connected || !connection.username) return null;
	try {
		const body = await read(
			'user.getRecentTracks',
			{ user: connection.username, limit: '200' },
			fetch
		);
		const observations = Array.isArray(body.recenttracks?.track) ? body.recenttracks.track : [];
		const weights = new Map<string, { name: string; mass: number }>();
		const recent: RecentSong[] = [];
		for (const track of observations) {
			const name = track.artist?.['#text'] ?? track.artist?.name;
			if (
				track['@attr']?.nowplaying === 'true' ||
				typeof name !== 'string' ||
				typeof track.name !== 'string'
			)
				continue;
			recent.push({
				artist: name,
				title: track.name,
				recordingId: typeof track.mbid === 'string' ? track.mbid : undefined,
				playedAt: Number(track.date?.uts) * 1000
			});
		}
		const songs = weightedRecentSongs(recent);
		const samples = songs.length;
		for (const song of songs) {
			const key = normalizeArtistName(song.artist);
			const value = weights.get(key) ?? { name: song.artist, mass: 0 };
			value.mass += song.weight;
			weights.set(key, value);
		}
		const artists: Record<string, number> = {};
		const genres: Record<string, number> = {};
		for (const [key, value] of [...weights].sort((a, b) => b[1].mass - a[1].mass).slice(0, 12)) {
			const found = normaliseSearchResults(
				await tidalApi.search(value.name, { types: ['artists'] }, ctx)
			).artists.filter((artist) => normalizeArtistName(artist.name) === key);
			if (found.length === 1) artists[found[0].id] = value.mass;
			const genreTags = await tags(value.name, undefined, fetch);
			const total = genreTags.reduce((sum, tag) => sum + tag.weight, 0);
			for (const tag of genreTags)
				genres[tag.name] = (genres[tag.name] ?? 0) + (value.mass * tag.weight) / total;
		}
		const normalize = (values: Record<string, number>) => {
			const max = Math.max(0, ...Object.values(values));
			return max
				? Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value / max]))
				: {};
		};
		return {
			artists: normalize(artists),
			genres: normalize(genres),
			samples,
			updatedAt: new Date().toISOString()
		};
	} catch {
		return null;
	}
}
