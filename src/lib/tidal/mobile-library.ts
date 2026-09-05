import type { TrackSummary } from './models';

export interface MobileSavedPlaylist {
	id: string;
	title: string;
	items: TrackSummary[];
}

export interface MobileLibraryData {
	tab: 'saved' | 'tracks';
	status: 'ready' | 'disconnected' | 'unavailable';
	playlists: MobileSavedPlaylist[];
	tracks: TrackSummary[];
	previousQuery: string | null;
	nextQuery: string | null;
	hasMore: boolean;
}
