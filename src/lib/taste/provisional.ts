/**
 * Client-safe shapes for a provisional (not-yet-saved) generated set.
 *
 * The taste pipeline that produces these lives under `#lib/server/taste`, whose
 * module graph reaches the database. Presentational components and their tests
 * only need the shape, so it lives here where the browser bundle can import it
 * without pulling the server in.
 */

/**
 * The evidence attached to a generated pick. This stays structured until the
 * client renders it through Paraglide, so server generation does not depend on
 * a request locale or persist a provider-derived sentence.
 */
export type ProvenanceReason =
	| {
			code: 'pinned_artist' | 'anchor_artist';
			artistId: string;
			artistName: string;
			releaseYear?: string;
	  }
	| {
			code: 'similar_artist';
			seedArtistId: string;
			seedArtistName: string;
			releaseYear?: string;
	  }
	| { code: 'profile_match'; releaseYear?: string };

export interface ProvisionalTrack {
	id: string;
	title: string;
	artists: Array<{ id: string; name: string }>;
	duration?: number;
	releaseDate?: string;
	reason: ProvenanceReason;
}

/** Stable confidence token; the display label is resolved in the request locale. */
export type ConfidenceLabel = 'none' | 'initial' | 'good' | 'high';

export interface ProvisionalSetSummary {
	trackCount: number;
	/** Sum of durations the provider actually supplied for this set. */
	knownDurationSeconds: number;
	/** Number of tracks whose duration is unknown; never treated as zero. */
	unknownDurationCount: number;
	/** A clearly labelled planning estimate, used only when duration is incomplete. */
	estimatedDurationSeconds: number;
	discoveryPercentage: number;
	confidenceLabel: ConfidenceLabel;
	degraded: boolean;
}

export interface ProvisionalSet extends ProvisionalSetSummary {
	tracks: ProvisionalTrack[];
	generatedAt: string;
}
