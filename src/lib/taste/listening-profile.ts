export const LISTEN_THRESHOLD_SECONDS = 30;
export const HALF_LIFE_DAYS = 90;
const DAY = 86_400_000;
export interface GenreEvidence {
	name: string;
	weight: number;
}
export interface Evidence {
	mass: number;
	day: string;
	today: number;
	lastAt: string;
}
export interface ListeningEvidence {
	version: 1;
	artists: Record<string, Evidence>;
	genres: Record<string, Evidence>;
	receipts: string[];
	qualifiedPlays: number;
	lastfm: {
		artists: Record<string, number>;
		genres: Record<string, number>;
		samples: number;
		updatedAt: string | null;
	};
}
export function emptyListeningEvidence(): ListeningEvidence {
	return {
		version: 1,
		artists: {},
		genres: {},
		receipts: [],
		qualifiedPlays: 0,
		lastfm: { artists: {}, genres: {}, samples: 0, updatedAt: null }
	};
}
export function decayedMass(evidence: Evidence, now: Date): number {
	const age = Math.max(0, (now.getTime() - Date.parse(evidence.lastAt)) / DAY);
	return Number.isFinite(age) ? evidence.mass * 2 ** (-age / HALF_LIFE_DAYS) : 0;
}
function add(previous: Evidence | undefined, credit: number, now: Date, cap = true): Evidence {
	const day = now.toISOString().slice(0, 10);
	const today = previous?.day === day ? previous.today : 0;
	const addition = cap ? (today < 6 ? credit / Math.sqrt(today + 1) : 0) : credit;
	return {
		mass: (previous ? decayedMass(previous, now) : 0) + addition,
		day,
		today: today + 1,
		lastAt: now.toISOString()
	};
}
function bounded<T extends { mass: number }>(
	values: Record<string, T>,
	limit: number
): Record<string, T> {
	return Object.fromEntries(
		Object.entries(values)
			.sort((a, b) => b[1].mass - a[1].mass || a[0].localeCompare(b[0]))
			.slice(0, limit)
	);
}
export function applyQualifiedListen(
	previous: ListeningEvidence,
	input: { receipt: string; listenedSeconds: number; artistIds: string[]; genres: GenreEvidence[] },
	now = new Date()
): { accepted: boolean; state: ListeningEvidence } {
	if (
		!Number.isFinite(input.listenedSeconds) ||
		input.listenedSeconds <= LISTEN_THRESHOLD_SECONDS ||
		previous.receipts.includes(input.receipt)
	)
		return { accepted: false, state: previous };
	const artistIds = [
		...new Set(
			input.artistIds.filter((id) => id && id.length <= 128 && !Object.hasOwn(Object.prototype, id))
		)
	];
	const artists = { ...previous.artists };
	const genres = { ...previous.genres };
	let credit = 0;
	for (const id of artistIds) {
		const before = artists[id];
		const next = add(before, 1 / artistIds.length, now);
		credit += next.mass - (before ? decayedMass(before, now) : 0);
		artists[id] = next;
	}
	const tags = input.genres.filter(
		(tag) =>
			tag.name &&
			tag.name.length <= 80 &&
			!Object.hasOwn(Object.prototype, tag.name) &&
			Number.isFinite(tag.weight) &&
			tag.weight > 0
	);
	const total = tags.reduce((sum, tag) => sum + tag.weight, 0);
	for (const tag of tags)
		genres[tag.name] = add(genres[tag.name], (credit * tag.weight) / total, now, false);
	return {
		accepted: true,
		state: {
			...previous,
			artists: bounded(artists, 1000),
			genres: bounded(genres, 100),
			receipts: [...previous.receipts.slice(-255), input.receipt],
			qualifiedPlays: previous.qualifiedPlays + 1
		}
	};
}
function normalize(values: Record<string, number>): Record<string, number> {
	const max = Math.max(0, ...Object.values(values));
	return max
		? Object.fromEntries(
				Object.entries(values).map(([key, value]) => [key, Number((value / max).toFixed(4))])
			)
		: {};
}
export function listeningAffinities(state: ListeningEvidence, now = new Date()) {
	const artists = Object.fromEntries(
		Object.entries(state.artists).map(([key, value]) => [key, decayedMass(value, now)])
	);
	const genres = Object.fromEntries(
		Object.entries(state.genres).map(([key, value]) => [key, decayedMass(value, now)])
	);
	const mass = Object.values(artists).reduce((sum, value) => sum + value, 0);
	return {
		artists: normalize(artists),
		genres: normalize(genres),
		confidence: mass / (mass + 20),
		genreConfidence:
			Object.values(genres).reduce((sum, value) => sum + value, 0) /
			(Object.values(genres).reduce((sum, value) => sum + value, 0) + 20)
	};
}
export function blendListeningTaste(
	base: Record<string, number>,
	state: ListeningEvidence,
	now = new Date()
) {
	const native = listeningAffinities(state, now);
	const lastfmAge = state.lastfm.updatedAt
		? Math.max(0, (now.getTime() - Date.parse(state.lastfm.updatedAt)) / DAY)
		: Infinity;
	const priorWeight =
		((0.25 * state.lastfm.samples) / (state.lastfm.samples + 40)) *
		2 ** (-lastfmAge / HALF_LIFE_DAYS);
	const nativeWeight = 0.7 * native.confidence;
	function mix(
		library: Record<string, number>,
		observed: Record<string, number>,
		prior: Record<string, number>
	) {
		const keys = new Set([
			...Object.keys(library),
			...Object.keys(observed),
			...Object.keys(prior)
		]);
		return normalize(
			Object.fromEntries(
				[...keys].map((key) => [
					key,
					(library[key] ?? 0) * 0.15 +
						(observed[key] ?? 0) * nativeWeight +
						(prior[key] ?? 0) * priorWeight
				])
			)
		);
	}
	return {
		artists: mix(base, native.artists, state.lastfm.artists),
		genres: mix({}, native.genres, state.lastfm.genres),
		confidence: native.confidence,
		genreConfidence: native.genreConfidence,
		qualifiedPlays: state.qualifiedPlays,
		lastfmScrobbles: state.lastfm.samples
	};
}
