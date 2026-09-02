/**
 * Small, stable display contracts returned by the TIDAL server boundary.
 *
 * These intentionally describe only metadata used by the first product slice.
 * They are not a second, incomplete copy of TIDAL's API schema.
 */

export interface ArtistReference {
	id: string;
	name: string;
}

export interface AlbumReference {
	id: string;
	title: string;
	imageUrl?: string;
	releaseDate?: string;
}

export interface TrackSummary {
	kind: 'track';
	id: string;
	title: string;
	artists: ArtistReference[];
	album?: AlbumReference;
	duration?: number;
	trackNumber?: number;
	volumeNumber?: number;
	explicit?: boolean;
	audioQuality?: string;
	isrc?: string;
	popularity?: number;
	copyright?: string;
	imageUrl?: string;
}

/**
 * The initial track page deliberately uses the same verified metadata as a
 * search result. Additional fields belong here only once a page needs them
 * and their upstream representation has been normalised safely.
 */
export type TrackDetail = TrackSummary;

export interface AlbumSummary {
	kind: 'album';
	id: string;
	title: string;
	artists: ArtistReference[];
	imageUrl?: string;
	releaseDate?: string;
	explicit?: boolean;
	popularity?: number;
	copyright?: string;
}

export interface ArtistSummary {
	kind: 'artist';
	id: string;
	name: string;
}

export interface PlaylistSummary {
	kind: 'playlist';
	id: string;
	title: string;
}

export type SearchResult = TrackSummary | AlbumSummary | ArtistSummary | PlaylistSummary;

/** Display-ready, type-grouped search results. */
export interface SearchResultGroups {
	tracks: TrackSummary[];
	albums: AlbumSummary[];
	artists: ArtistSummary[];
	playlists: PlaylistSummary[];
}
