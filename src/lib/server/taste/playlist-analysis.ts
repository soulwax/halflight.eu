/**
 * Pure playlist analysis for the background taste worker. Everything here works
 * on identifiers and dates only; no titles or track lists are kept.
 */

const DAY = 86_400_000;

/** At most this many items are read from one playlist: a sample, not an archive. */
export const MAX_ITEMS_PER_PLAYLIST = 300;
/** Bound the work and storage for listeners with very large libraries. */
export const MAX_PLAYLISTS = 200;
const MAX_ARTISTS_PER_PLAYLIST = 150;
const MAX_PROFILE_ARTISTS = 500;
/** A playlist that keeps failing is skipped until it changes. */
export const MAX_PLAYLIST_FAILURES = 3;

/** First pass: deliberately slow, one playlist at a time. */
export const FIRST_PASS_SPACING_MS = 90_000;
/** Later passes only touch changed playlists, so they may move faster. */
export const REFRESH_SPACING_MS = 20_000;
/** How often the playlist list itself is re-read for changes. */
export const RELIST_INTERVAL_MS = DAY;

export interface PlaylistItemFacts {
	/** Credited artist IDs, primary first. */
	artistIds: string[];
	releaseDate?: string;
	/** When the listener put the song in this playlist. */
	addedAt?: string;
}

export interface PlaylistDigest {
	version: string;
	analyzedAt: string;
	items: number;
	artists: Record<string, number>;
	eras: Record<string, number>;
}

export interface PlaylistAnalysisState {
	version: 1;
	/** Set once every playlist has been analysed at least once. */
	firstPassCompletedAt: string | null;
	listedAt: string | null;
	/** Playlist IDs still to analyse in this pass, in order. */
	pending: string[];
	/** Last listed version per playlist ID. */
	known: Record<string, string>;
	playlists: Record<string, PlaylistDigest>;
	failures: Record<string, number>;
}

export function emptyAnalysisState(): PlaylistAnalysisState {
	return {
		version: 1,
		firstPassCompletedAt: null,
		listedAt: null,
		pending: [],
		known: {},
		playlists: {},
		failures: {}
	};
}

export function parseAnalysisState(value: unknown): PlaylistAnalysisState {
	const raw = value as Partial<PlaylistAnalysisState> | null;
	if (!raw || raw.version !== 1) return emptyAnalysisState();
	return {
		...emptyAnalysisState(),
		...raw,
		pending: Array.isArray(raw.pending) ? raw.pending.filter((id) => typeof id === 'string') : []
	};
}

/** Songs added recently say more about current taste: up to twice the weight. */
function addedRecency(addedAt: string | undefined, now: Date): number {
	const at = addedAt ? Date.parse(addedAt) : NaN;
	if (!Number.isFinite(at)) return 1;
	return 1 + Math.exp(-Math.max(0, now.getTime() - at) / DAY / 180);
}

function decade(releaseDate: string | undefined): string | null {
	const year = Number(releaseDate?.slice(0, 4));
	return Number.isInteger(year) && year >= 1880 && year <= 2100
		? String(Math.floor(year / 10) * 10)
		: null;
}

function top(weights: Record<string, number>, limit: number): Record<string, number> {
	return Object.fromEntries(
		Object.entries(weights)
			.sort(([, a], [, b]) => b - a)
			.slice(0, limit)
	);
}

function normalise(weights: Record<string, number>): Record<string, number> {
	const max = Math.max(0, ...Object.values(weights));
	if (!max) return {};
	return Object.fromEntries(
		Object.entries(weights).map(([key, value]) => [key, Number((value / max).toFixed(4))])
	);
}

/**
 * One playlist's taste evidence. An artist's score saturates (one song ≈ 0.28,
 * three ≈ 0.63, ten ≈ 0.96), so a single-artist playlist cannot dominate, while
 * the primary artist counts fully and featured artists half.
 */
export function digestPlaylist(
	items: PlaylistItemFacts[],
	version: string,
	now = new Date()
): PlaylistDigest {
	const mass: Record<string, number> = {};
	const eras: Record<string, number> = {};
	let dated = 0;
	for (const item of items) {
		const recency = addedRecency(item.addedAt, now);
		item.artistIds.forEach((id, index) => {
			if (id) mass[id] = (mass[id] ?? 0) + recency * (index === 0 ? 1 : 0.5);
		});
		const era = decade(item.releaseDate);
		if (era) {
			eras[era] = (eras[era] ?? 0) + 1;
			dated += 1;
		}
	}
	const artists = Object.fromEntries(
		Object.entries(mass).map(([id, value]) => [id, Number((1 - Math.exp(-value / 3)).toFixed(4))])
	);
	return {
		version,
		analyzedAt: now.toISOString(),
		items: items.length,
		artists: top(artists, MAX_ARTISTS_PER_PLAYLIST),
		eras: dated
			? Object.fromEntries(
					Object.entries(eras).map(([key, count]) => [key, Number((count / dated).toFixed(4))])
				)
			: {}
	};
}

/**
 * Combine every analysed playlist. Larger playlists carry more evidence, with
 * diminishing returns; an artist found across many playlists rises naturally.
 */
export function aggregateDigests(playlists: Record<string, PlaylistDigest>): {
	artists: Record<string, number>;
	eras: Record<string, number>;
	playlistCount: number;
} {
	const artists: Record<string, number> = {};
	const eras: Record<string, number> = {};
	const digests = Object.values(playlists).filter((digest) => digest.items > 0);
	for (const digest of digests) {
		const weight = Math.max(0.2, Math.sqrt(Math.min(digest.items, 200) / 200));
		for (const [id, score] of Object.entries(digest.artists))
			artists[id] = (artists[id] ?? 0) + weight * score;
		for (const [era, share] of Object.entries(digest.eras))
			eras[era] = (eras[era] ?? 0) + weight * share;
	}
	return {
		artists: normalise(top(artists, MAX_PROFILE_ARTISTS)),
		eras: normalise(eras),
		playlistCount: digests.length
	};
}

/**
 * Apply a fresh playlist listing: queue new and changed playlists, forget
 * removed ones. Unchanged playlists keep their digest and cost nothing.
 */
export function applyListing(
	state: PlaylistAnalysisState,
	listed: { id: string; version: string }[],
	now = new Date()
): PlaylistAnalysisState {
	const known = Object.fromEntries(
		listed.slice(0, MAX_PLAYLISTS).map(({ id, version }) => [id, version])
	);
	const playlists = Object.fromEntries(
		Object.entries(state.playlists).filter(([id]) => id in known)
	);
	const failures = Object.fromEntries(
		Object.entries(state.failures).filter(([id]) => id in known && state.known[id] === known[id])
	);
	const pending = Object.keys(known).filter(
		(id) => playlists[id]?.version !== known[id] && (failures[id] ?? 0) < MAX_PLAYLIST_FAILURES
	);
	return { ...state, known, playlists, failures, pending, listedAt: now.toISOString() };
}

export function isListingDue(state: PlaylistAnalysisState, now = new Date()): boolean {
	if (state.pending.length) return false;
	const listed = state.listedAt ? Date.parse(state.listedAt) : NaN;
	return !Number.isFinite(listed) || now.getTime() - listed >= RELIST_INTERVAL_MS;
}

/** Spacing between steps: slow until the first full pass has completed. */
export function stepSpacing(state: PlaylistAnalysisState): number {
	return state.firstPassCompletedAt ? REFRESH_SPACING_MS : FIRST_PASS_SPACING_MS;
}

export interface AnalysisProgress {
	analysed: number;
	total: number;
	firstPassComplete: boolean;
	pending: number;
}

export function analysisProgress(state: PlaylistAnalysisState): AnalysisProgress {
	const total = Object.keys(state.known).length;
	return {
		analysed: Object.keys(state.playlists).length,
		total,
		firstPassComplete: Boolean(state.firstPassCompletedAt),
		pending: state.pending.length
	};
}
