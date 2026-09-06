/**
 * Client-safe shapes for a provisional (not-yet-saved) generated set.
 *
 * The taste pipeline that produces these lives under `#lib/server/taste`, whose
 * module graph reaches the database. Presentational components and their tests
 * only need the shape, so it lives here where the browser bundle can import it
 * without pulling the server in.
 */

export interface ProvisionalTrack {
	id: string;
	title: string;
	artists: Array<{ id: string; name: string }>;
	duration?: number;
	releaseDate?: string;
	provenance: string;
}

export interface ProvisionalSetSummary {
	summary: string;
	trackCount: number;
	totalDurationFormatted: string;
	totalDurationSeconds: number;
	discoveryPercentage: number;
	confidenceLabel: string;
	degraded: boolean;
}

export interface ProvisionalSet extends ProvisionalSetSummary {
	tracks: ProvisionalTrack[];
	generatedAt: string;
}
