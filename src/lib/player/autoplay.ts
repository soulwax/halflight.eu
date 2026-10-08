import type { TrackSummary } from '#lib/tidal/models';

/** The identity the server needs to recognise a recording, and nothing else. */
export interface AutoplayKnownTrack {
	id: string;
	title?: string;
	artist?: string;
	isrc?: string;
}

const MAX_SEEDS = 3;
const MAX_EXCLUDED = 300;

function known(track: TrackSummary): AutoplayKnownTrack {
	return {
		id: track.id,
		title: track.title.slice(0, 300),
		...(track.artists[0]?.name ? { artist: track.artists[0].name.slice(0, 300) } : {}),
		...(track.isrc ? { isrc: track.isrc } : {})
	};
}

const isCatalogueId = (track: TrackSummary) => /^\d{1,20}$/.test(track.id);

/**
 * Seeds are the current track and the most recent distinct ones before it;
 * everything current, queued or recently heard is excluded from the batch.
 */
export function autoplayRequestBody(
	current: TrackSummary,
	history: readonly TrackSummary[],
	queue: readonly TrackSummary[]
): { seeds: AutoplayKnownTrack[]; exclude: AutoplayKnownTrack[] } | null {
	const recent = [current, ...[...history].reverse()].filter(isCatalogueId);
	const seeds: AutoplayKnownTrack[] = [];
	for (const track of recent) {
		if (seeds.length >= MAX_SEEDS) break;
		if (!seeds.some((seed) => seed.id === track.id)) seeds.push(known(track));
	}
	if (!seeds.length) return null;
	const exclude = new Map<string, AutoplayKnownTrack>();
	for (const track of [...queue, ...recent]) {
		if (exclude.size >= MAX_EXCLUDED) break;
		if (isCatalogueId(track) && !exclude.has(track.id)) exclude.set(track.id, known(track));
	}
	return { seeds, exclude: [...exclude.values()] };
}

/** Drop anything that reached the session while the request was in flight. */
export function freshSuggestions(
	suggestions: readonly TrackSummary[],
	session: readonly TrackSummary[]
): TrackSummary[] {
	const seen = new Set(session.map((track) => track.id));
	return suggestions.filter((track) => {
		if (seen.has(track.id)) return false;
		seen.add(track.id);
		return true;
	});
}

export function readSuggestedTracks(value: unknown): TrackSummary[] {
	const tracks = (value as { tracks?: unknown } | null)?.tracks;
	if (!Array.isArray(tracks)) return [];
	return tracks.filter(
		(track): track is TrackSummary =>
			Boolean(track) &&
			typeof track === 'object' &&
			track.kind === 'track' &&
			typeof track.id === 'string' &&
			typeof track.title === 'string' &&
			Array.isArray(track.artists)
	);
}
