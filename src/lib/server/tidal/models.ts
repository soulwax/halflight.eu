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
}

export interface TrackSummary {
	kind: 'track';
	id: string;
	title: string;
	artists: ArtistReference[];
	album?: AlbumReference;
}

export interface AlbumSummary {
	kind: 'album';
	id: string;
	title: string;
	artists: ArtistReference[];
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
