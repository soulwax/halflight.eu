import { getArtistRelationship } from '#lib/server/tidal/api';
import type { TidalRequestContext } from '#lib/server/tidal';

export interface GraphCandidateTrack {
	id: string;
	title: string;
	isrc?: string;
	releaseDate?: string;
	duration?: number;
	explicit?: boolean;
	artists: Array<{ id: string; name: string }>;
	provenance: {
		edge: 'anchor' | 'similar_artist';
		seedArtistId: string;
		seedArtistName?: string;
	};
}

type GraphTrack = {
	id: string;
	title: string;
	isrc?: string;
	releaseDate?: string;
	duration?: number;
	explicit?: boolean;
	artists: Array<{ id: string; name: string }>;
};

export interface GraphExpansionClient {
	getSimilarArtists(
		artistId: string,
		signal?: AbortSignal
	): Promise<Array<{ id: string; name?: string }>>;
	getArtistTracks(artistId: string, signal?: AbortSignal): Promise<GraphTrack[]>;
}

export interface GraphExpansionBudget {
	maxRequests: number;
	fanoutLimit: number;
	/**
	 * Wall-clock ceiling for the whole expansion. Once exceeded, expansion stops
	 * where it is and returns a partial, `degraded` result rather than letting a
	 * slow upstream stall generation. Omit to disable the time check.
	 */
	deadlineMs?: number;
	/**
	 * Minimum gap between upstream requests. TIDAL rate-limits sustained probing
	 * within a couple of dozen calls, so expansion paces itself rather than
	 * firing the whole budget back-to-back. Counts toward `deadlineMs`.
	 */
	pacingMs?: number;
	/** Maximum time one upstream graph read can occupy within the run deadline. */
	requestTimeoutMs?: number;
}

export const DEFAULT_GRAPH_BUDGET: GraphExpansionBudget = {
	maxRequests: 15,
	fanoutLimit: 5,
	deadlineMs: 9000,
	pacingMs: 120,
	requestTimeoutMs: 5000
};

/**
 * Default live client wrapper over TIDAL API v2 relationships
 */
export function createLiveGraphClient(ctx?: TidalRequestContext): GraphExpansionClient {
	const withSignal = (signal?: AbortSignal): TidalRequestContext | undefined =>
		signal ? { ...ctx, signal } : ctx;
	return {
		async getSimilarArtists(artistId, signal) {
			const res = await getArtistRelationship(artistId, 'similarArtists', {}, withSignal(signal));
			const data = Array.isArray(res.data) ? res.data : [res.data];
			return data.filter(Boolean).map((item) => ({
				id: String(item.id),
				name:
					item.attributes && 'name' in item.attributes ? String(item.attributes.name) : undefined
			}));
		},
		async getArtistTracks(artistId, signal) {
			const res = await getArtistRelationship(
				artistId,
				'tracks',
				{ collapseBy: 'FINGERPRINT' },
				withSignal(signal)
			);
			const data = Array.isArray(res.data) ? res.data : [res.data];

			return data.filter(Boolean).map((item) => {
				const attrs = item.attributes ?? {};
				const artistsList: Array<{ id: string; name: string }> = [];

				// Check relationships or attributes for artists
				if (Array.isArray(attrs.artists)) {
					for (const a of attrs.artists) {
						if (typeof a === 'object' && a !== null && 'id' in a) {
							artistsList.push({
								id: String(a.id),
								name: String((a as { name?: string }).name ?? '')
							});
						}
					}
				}

				if (artistsList.length === 0) {
					artistsList.push({ id: artistId, name: '' });
				}

				return {
					id: String(item.id),
					title: typeof attrs.title === 'string' ? attrs.title : 'Untitled Track',
					isrc: typeof attrs.isrc === 'string' ? attrs.isrc : undefined,
					releaseDate: typeof attrs.releaseDate === 'string' ? attrs.releaseDate : undefined,
					duration: typeof attrs.duration === 'number' ? attrs.duration : undefined,
					explicit: typeof attrs.explicit === 'boolean' ? attrs.explicit : undefined,
					artists: artistsList
				};
			});
		}
	};
}

export interface ExpansionResult {
	candidates: GraphCandidateTrack[];
	requestsSpent: number;
	degraded: boolean;
}

export interface GraphProgress {
	requestsSpent: number;
	candidateCount: number;
}

function abortReason(signal: AbortSignal): unknown {
	return signal.reason ?? new DOMException('The generation was cancelled.', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw abortReason(signal);
}

function requestSignal(
	parent: AbortSignal | undefined,
	timeoutMs: number
): {
	signal: AbortSignal;
	cleanup: () => void;
} {
	const controller = new AbortController();
	const onAbort = () => controller.abort(parent ? abortReason(parent) : undefined);
	if (parent?.aborted) onAbort();
	else parent?.addEventListener('abort', onAbort, { once: true });
	const timer = setTimeout(
		() => controller.abort(new DOMException('Graph read timed out.', 'TimeoutError')),
		timeoutMs
	);
	return {
		signal: controller.signal,
		cleanup: () => {
			clearTimeout(timer);
			parent?.removeEventListener('abort', onAbort);
		}
	};
}

/**
 * Budgeted graph expansion: walks anchor artists, expands similar artists,
 * fetches candidate tracks, and tracks request limits and degradation.
 */
export async function expandTasteGraph(
	anchorArtists: Array<{ id: string; name?: string; weight: number }>,
	client: GraphExpansionClient,
	budget: GraphExpansionBudget = DEFAULT_GRAPH_BUDGET,
	clock: () => number = () => Date.now(),
	sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	signal?: AbortSignal,
	onProgress?: (progress: GraphProgress) => void
): Promise<ExpansionResult> {
	const candidates: GraphCandidateTrack[] = [];
	let requestsSpent = 0;
	let degraded = false;

	const startedAt = clock();
	const budgetSpent = (): boolean => {
		if (requestsSpent >= budget.maxRequests) return true;
		if (budget.deadlineMs !== undefined && clock() - startedAt >= budget.deadlineMs) return true;
		return false;
	};
	const read = async <T>(
		operation: (requestAbortSignal: AbortSignal) => Promise<T>
	): Promise<T> => {
		throwIfAborted(signal);
		const remaining =
			budget.deadlineMs === undefined
				? (budget.requestTimeoutMs ?? 5000)
				: Math.max(
						1,
						Math.min(budget.requestTimeoutMs ?? 5000, budget.deadlineMs - (clock() - startedAt))
					);
		const request = requestSignal(signal, remaining);
		try {
			return await operation(request.signal);
		} finally {
			request.cleanup();
		}
	};
	const reportProgress = () => onProgress?.({ requestsSpent, candidateCount: candidates.length });

	// Space out upstream calls (but never before the first one).
	const pace = async (): Promise<void> => {
		if (requestsSpent > 0 && budget.pacingMs) await sleep(budget.pacingMs);
	};

	const sortedAnchors = [...anchorArtists].sort((a, b) => b.weight - a.weight);
	const targetAnchors = sortedAnchors.slice(0, budget.fanoutLimit);

	// 1. Fetch tracks for top anchor artists
	for (const anchor of targetAnchors) {
		throwIfAborted(signal);
		if (budgetSpent()) {
			degraded = true;
			break;
		}

		try {
			await pace();
			requestsSpent++;
			const tracks = await read((requestAbortSignal) =>
				client.getArtistTracks(anchor.id, requestAbortSignal)
			);
			for (const track of tracks) {
				candidates.push({
					...track,
					provenance: {
						edge: 'anchor',
						seedArtistId: anchor.id,
						seedArtistName: anchor.name
					}
				});
			}
			reportProgress();
		} catch (cause) {
			if (signal?.aborted) throw cause;
			degraded = true;
		}
	}

	// 2. Discover similar artists for the top anchors
	for (const anchor of targetAnchors) {
		throwIfAborted(signal);
		if (budgetSpent()) {
			degraded = true;
			break;
		}

		try {
			await pace();
			requestsSpent++;
			const similarList = await read((requestAbortSignal) =>
				client.getSimilarArtists(anchor.id, requestAbortSignal)
			);
			reportProgress();
			const topSimilar = similarList.slice(0, 3);

			for (const similar of topSimilar) {
				throwIfAborted(signal);
				if (budgetSpent()) {
					degraded = true;
					break;
				}

				try {
					await pace();
					requestsSpent++;
					const similarTracks = await read((requestAbortSignal) =>
						client.getArtistTracks(similar.id, requestAbortSignal)
					);
					for (const track of similarTracks) {
						candidates.push({
							...track,
							provenance: {
								edge: 'similar_artist',
								seedArtistId: anchor.id,
								seedArtistName: anchor.name
							}
						});
					}
					reportProgress();
				} catch (cause) {
					if (signal?.aborted) throw cause;
					degraded = true;
				}
			}
		} catch (cause) {
			if (signal?.aborted) throw cause;
			degraded = true;
		}
	}

	return {
		candidates,
		requestsSpent,
		degraded
	};
}
