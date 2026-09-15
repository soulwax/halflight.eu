import type { TrackSummary } from './models';
import type { PrivateMusicLibraryData } from '#lib/private-music';

export interface MobileSavedPlaylist {
	id: string;
	title: string;
	items: TrackSummary[];
}

export interface MobileLibraryData {
	tab: 'private' | 'saved' | 'tracks';
	status: 'ready' | 'disconnected' | 'unavailable';
	privateMusic: PrivateMusicLibraryData;
	playlists: MobileSavedPlaylist[];
	tracks: TrackSummary[];
	previousQuery: string | null;
	nextQuery: string | null;
	hasMore: boolean;
}
