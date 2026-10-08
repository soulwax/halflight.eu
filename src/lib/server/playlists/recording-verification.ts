import { search } from '#lib/server/tidal/api';
import { normaliseSearchResults } from '#lib/server/tidal/normalise';
import type { TrackSummary } from '#lib/tidal/models';
import type { TidalRequestContext } from '#lib/server/tidal/client';
import type { TrackAudioQuality } from '#lib/server/tidal/stream';
import { validatePlaylistPlayback } from './playback-validation';

function normalized(value: string): string {
	return value
		.toLowerCase()
		.replaceAll('ø', 'oe')
		.replaceAll('ß', 'ss')
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}
function isrc(value?: string): string {
	return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Same ISRC wins; best-fit requires matching title/version and a credited artist. */
export function recordingMatchScore(source: TrackSummary, candidate: TrackSummary): number {
	if (source.id === candidate.id || !/^\d+$/.test(candidate.id)) return 0;
	const artistsMatch = source.artists.some((artist) =>
		candidate.artists.some(
			(other) =>
				(artist.id && artist.id === other.id) ||
				(normalized(artist.name) && normalized(artist.name) === normalized(other.name))
		)
	);
	if (!artistsMatch) return 0;
	const exactIsrc =
		/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc(source.isrc)) &&
		isrc(source.isrc) === isrc(candidate.isrc);
	if (
		source.explicit !== undefined &&
		candidate.explicit !== undefined &&
		source.explicit !== candidate.explicit
	)
		return 0;
	if (source.duration && candidate.duration && Math.abs(source.duration - candidate.duration) > 5)
		return 0;
	if (exactIsrc) return 100;
	if (!normalized(source.title) || normalized(source.title) !== normalized(candidate.title))
		return 0;
	const first = source.artists[0];
	const other = candidate.artists[0];
	if (
		!first ||
		!other ||
		!((first.id && first.id === other.id) || normalized(first.name) === normalized(other.name))
	)
		return 0;
	return 80 + (source.duration && candidate.duration ? 10 : 0);
}

export const recordingVerificationSources = { search, validate: validatePlaylistPlayback };

export interface ReplacementCandidate {
	track: TrackSummary;
	match: 'isrc' | 'best_fit';
	score: number;
}

export async function findVerifiedReplacements(
	source: TrackSummary,
	ownerId: string,
	ctx: TidalRequestContext,
	quality: TrackAudioQuality,
	sources = recordingVerificationSources
): Promise<ReplacementCandidate[]> {
	if (!source.artists.length) return [];
	const candidates = new Map<string, TrackSummary>();
	const queries = [
		...new Set(
			[source.isrc, `${source.title} ${source.artists[0].name}`].filter((query): query is string =>
				Boolean(query)
			)
		)
	];
	for (const query of queries) {
		ctx.signal?.throwIfAborted();
		const document = await sources.search(
			query,
			{ types: ['tracks'], include: ['tracks.artists', 'tracks.albums'] },
			ctx
		);
		for (const track of normaliseSearchResults(document).tracks)
			if (recordingMatchScore(source, track)) candidates.set(track.id, track);
	}
	const ranked = [...candidates.values()].sort(
		(a, b) =>
			recordingMatchScore(source, b) - recordingMatchScore(source, a) || a.id.localeCompare(b.id)
	);
	const result: ReplacementCandidate[] = [];
	for (const candidate of ranked.slice(0, 5)) {
		ctx.signal?.throwIfAborted();
		if (!(await sources.validate([candidate], ownerId, ctx, quality, true)).length) continue;
		const score = recordingMatchScore(source, candidate);
		result.push({ track: candidate, match: score === 100 ? 'isrc' : 'best_fit', score });
	}
	return result;
}

/** Preserve source order, duplicates and previously confirmed local replacements. */
export async function verifyImportedRecordings(
	tracks: TrackSummary[],
	ownerId: string,
	ctx: TidalRequestContext,
	quality: TrackAudioQuality,
	sources = recordingVerificationSources,
	preferred: Map<string, TrackSummary> = new Map()
): Promise<{ tracks: TrackSummary[]; replacements: number; bestFits: number; skipped: number }> {
	const originals = await sources.validate(tracks, ownerId, ctx, quality, true);
	const available = new Map(originals.map((track) => [track.id, track]));
	const replacements = new Map<string, ReplacementCandidate>();
	for (const source of new Map(tracks.map((track) => [track.id, track])).values()) {
		const confirmed = preferred.get(source.id);
		const score = confirmed ? recordingMatchScore(source, confirmed) : 0;
		if (
			confirmed &&
			(score || confirmed.replacementForId === source.id) &&
			(await sources.validate([confirmed], ownerId, ctx, quality, true)).length
		) {
			replacements.set(source.id, {
				track: confirmed,
				match: score === 100 ? 'isrc' : 'best_fit',
				score: score || 80
			});
			continue;
		}
		if (available.has(source.id)) continue;
		const candidate = (await findVerifiedReplacements(source, ownerId, ctx, quality, sources))[0];
		if (candidate) replacements.set(source.id, candidate);
	}
	let relinked = 0;
	let bestFits = 0;
	const result: TrackSummary[] = [];
	for (const source of tracks) {
		const replacement = replacements.get(source.id);
		if (replacement) {
			result.push({ ...replacement.track, replacementForId: source.id });
			relinked++;
			if (replacement.match === 'best_fit') bestFits++;
		} else if (available.has(source.id)) result.push(available.get(source.id)!);
	}
	return {
		tracks: result,
		replacements: relinked,
		bestFits,
		skipped: tracks.length - result.length
	};
}
