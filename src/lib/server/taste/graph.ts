import { getArtistRelationship } from '#lib/server/tidal/api';
import type { TidalRequestContext } from '#lib/server/tidal';

export interface GraphCandidateTrack {
	id: string;
	title: string;
	isrc?: string;
	releaseDate?: string;
	duration?: number;
	artists: Array<{ id: string; name: string }>;
	provenance: {
		edge: 'anchor' | 'similar_artist';
		seedArtistId: string;
		seedArtistName?: string;
	};
}

export interface GraphExpansionClient {
	getSimilarArtists(artistId: string): Promise<Array<{ id: string; name?: string }>>;
	getArtistTracks(artistId: string): Promise<
		Array<{
			id: string;
			title: string;
			isrc?: string;
			releaseDate?: string;
			duration?: number;
			artists: Array<{ id: string; name: string }>;
		}>
	>;
}

export interface GraphExpansionBudget {
	maxRequests: number;
	fanoutLimit: number;
}

export const DEFAULT_GRAPH_BUDGET: GraphExpansionBudget = {
	maxRequests: 15,
	fanoutLimit: 5
};

/**
 * Default live client wrapper over TIDAL API v2 relationships
 */
export function createLiveGraphClient(ctx?: TidalRequestContext): GraphExpansionClient {
	return {
		async getSimilarArtists(artistId) {
			const res = await getArtistRelationship(artistId, 'similarArtists', {}, ctx);
			const data = Array.isArray(res.data) ? res.data : [res.data];
			return data.filter(Boolean).map((item) => ({
				id: String(item.id),
				name:
					item.attributes && 'name' in item.attributes ? String(item.attributes.name) : undefined
			}));
		},
		async getArtistTracks(artistId) {
			const res = await getArtistRelationship(
				artistId,
				'tracks',
				{ collapseBy: 'FINGERPRINT' },
				ctx
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

/**
 * Budgeted graph expansion: walks anchor artists, expands similar artists,
 * fetches candidate tracks, and tracks request limits and degradation.
 */
export async function expandTasteGraph(
	anchorArtists: Array<{ id: string; name?: string; weight: number }>,
	client: GraphExpansionClient,
	budget: GraphExpansionBudget = DEFAULT_GRAPH_BUDGET
): Promise<ExpansionResult> {
	const candidates: GraphCandidateTrack[] = [];
	let requestsSpent = 0;
	let degraded = false;

	const sortedAnchors = [...anchorArtists].sort((a, b) => b.weight - a.weight);
	const targetAnchors = sortedAnchors.slice(0, budget.fanoutLimit);

	// 1. Fetch tracks for top anchor artists
	for (const anchor of targetAnchors) {
		if (requestsSpent >= budget.maxRequests) {
			degraded = true;
			break;
		}

		try {
			requestsSpent++;
			const tracks = await client.getArtistTracks(anchor.id);
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
		} catch {
			degraded = true;
		}
	}

	// 2. Discover similar artists for the top anchors
	for (const anchor of targetAnchors) {
		if (requestsSpent >= budget.maxRequests) {
			degraded = true;
			break;
		}

		try {
			requestsSpent++;
			const similarList = await client.getSimilarArtists(anchor.id);
			const topSimilar = similarList.slice(0, 3);

			for (const similar of topSimilar) {
				if (requestsSpent >= budget.maxRequests) {
					degraded = true;
					break;
				}

				try {
					requestsSpent++;
					const similarTracks = await client.getArtistTracks(similar.id);
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
				} catch {
					degraded = true;
				}
			}
		} catch {
			degraded = true;
		}
	}

	return {
		candidates,
		requestsSpent,
		degraded
	};
}
