import type { TrackSummary } from '#lib/tidal/models';
import type { TasteProfile } from '#lib/server/taste/profile';

/** What the client already has: enough to recognise the same recording under another ID. */
export interface KnownTrack {
	id: string;
	title?: string;
	artist?: string;
	isrc?: string;
}

export interface AutoplayInput {
	/** Most recent first; the first is what just played. */
	seeds: KnownTrack[];
	/** Current, queued and recently played tracks that must not come back. */
	exclude: KnownTrack[];
	count: number;
	/** Present only when the listener lets suggestions use their taste profile. */
	profile?: Pick<TasteProfile, 'artists' | 'exclusions' | 'overrides'>;
}

export interface AutoplaySources {
	/** Radio for one seed, best match first. Failures are tolerated per seed. */
	radio(trackId: string): Promise<TrackSummary[]>;
	/** Drops recordings already known to be unplayable. */
	playable(tracks: TrackSummary[]): Promise<TrackSummary[]>;
}

export const MAX_SEEDS = 3;
/** Variety, Spotify style: an artist may return, but not dominate a batch. */
export const MAX_PER_ARTIST = 2;

function normalized(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

/**
 * Edition noise ("Remastered 2011", "Radio Edit", "feat. X") makes the same song
 * look new. Strip it so a remaster of something just heard is not suggested.
 */
export function baseTitle(title: string): string {
	return normalized(
		title
			.replace(/\s*[([][^)\]]*[)\]]/g, ' ')
			.replace(/\s+-\s+.*$/, ' ')
			.replace(/\s+(feat|ft)\.?\s.*$/i, ' ')
	);
}

export function recordingKeys(track: KnownTrack): string[] {
	const keys = [`id:${track.id}`];
	const isrc = track.isrc?.toUpperCase().replace(/[^A-Z0-9]/g, '');
	if (isrc && isrc.length === 12) keys.push(`isrc:${isrc}`);
	const title = track.title ? baseTitle(track.title) : '';
	const artist = track.artist ? normalized(track.artist) : '';
	if (title && artist) keys.push(`song:${artist}|${title}`);
	return keys;
}

export function knownFromTrack(track: TrackSummary): KnownTrack {
	return { id: track.id, title: track.title, artist: track.artists[0]?.name, isrc: track.isrc };
}

function decade(track: TrackSummary): number | null {
	const year = Number(track.album?.releaseDate?.slice(0, 4));
	return Number.isInteger(year) && year > 1800 ? Math.floor(year / 10) * 10 : null;
}

/** Round-robin across seeds so the batch follows the whole recent session, not one song. */
function interleave(lists: TrackSummary[][]): { track: TrackSummary; rank: number }[] {
	const merged: { track: TrackSummary; rank: number }[] = [];
	const longest = Math.max(0, ...lists.map((list) => list.length));
	for (let index = 0; index < longest; index++)
		for (const list of lists)
			if (list[index]) merged.push({ track: list[index], rank: merged.length });
	return merged;
}

/**
 * Pick the songs that continue a session after its queue ends: radio for the
 * most recent tracks, deduplicated by ID, ISRC and song identity against
 * everything the listener has queued or just heard, and optionally shaped by
 * their taste profile.
 */
export async function suggestAutoplayTracks(
	input: AutoplayInput,
	sources: AutoplaySources
): Promise<TrackSummary[]> {
	const seen = new Set<string>();
	for (const known of [...input.seeds, ...input.exclude])
		for (const key of recordingKeys(known)) seen.add(key);

	const lists: TrackSummary[][] = [];
	for (const seed of input.seeds.slice(0, MAX_SEEDS)) {
		try {
			lists.push(await sources.radio(seed.id));
		} catch {
			// One unavailable seed must not stop the session from continuing.
		}
	}

	const profile = input.profile;
	const excludedArtists = new Set(profile?.exclusions.artists ?? []);
	const excludedEras = new Set(profile?.exclusions.eras ?? []);
	const pool = interleave(lists).filter(({ track }) => {
		if (track.artists.some((artist) => excludedArtists.has(artist.id))) return false;
		const era = decade(track);
		return era === null || !excludedEras.has(era);
	});

	const scored = pool.map(({ track, rank }) => {
		// Radio order is the base relevance; taste only reorders within it.
		let score = 1 - rank / Math.max(1, pool.length);
		if (profile) {
			const artistId = track.artists[0]?.id ?? '';
			const override = profile.overrides.artists[artistId];
			score += 0.5 * (profile.artists[artistId] ?? 0);
			if (override === 'pinned') score += 0.5;
			if (override === 'dampened') score -= 0.5;
		}
		return { track, score };
	});
	scored.sort((a, b) => b.score - a.score);

	const picked: TrackSummary[] = [];
	const perArtist = new Map<string, number>();
	for (const { track } of scored) {
		const keys = recordingKeys(knownFromTrack(track));
		if (keys.some((key) => seen.has(key))) continue;
		const artist = track.artists[0]?.id || normalized(track.artists[0]?.name ?? '');
		if ((perArtist.get(artist) ?? 0) >= MAX_PER_ARTIST) continue;
		for (const key of keys) seen.add(key);
		perArtist.set(artist, (perArtist.get(artist) ?? 0) + 1);
		picked.push(track);
		// Headroom for playability filtering below.
		if (picked.length >= input.count * 2) break;
	}
	return (await sources.playable(picked)).slice(0, input.count);
}
