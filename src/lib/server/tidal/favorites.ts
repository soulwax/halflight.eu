import { getAccessToken, type TidalRequestContext } from './client';
import { TidalApiError } from './errors';

export interface UserFavoritesRaw {
	TRACK?: (number | string)[];
	ALBUM?: (number | string)[];
	ARTIST?: (number | string)[];
	PLAYLIST?: string[];
	VIDEO?: (number | string)[];
}

export interface UserFavorites {
	tracks: string[];
	albums: string[];
	artists: string[];
	playlists: string[];
	videos: string[];
	totalCount: number;
}

/**
 * Fetches user's favorite IDs across all resource categories from TIDAL v1 API.
 * Translates tiddl/core/api/api.py:get_favorites.
 */
export async function fetchUserFavorites(
	userId: string | number,
	options: {
		ctx?: TidalRequestContext;
		accessToken?: string;
		countryCode?: string;
	} = {}
): Promise<UserFavorites> {
	const token = options.accessToken ?? (await getAccessToken(options.ctx));
	const f = options.ctx?.fetch ?? fetch;

	const query = options.countryCode
		? `?countryCode=${encodeURIComponent(options.countryCode)}`
		: '';
	const url = `https://api.tidal.com/v1/users/${encodeURIComponent(String(userId))}/favorites/ids${query}`;

	const response = await f(url, {
		headers: {
			authorization: `Bearer ${token}`,
			accept: 'application/json'
		}
	});

	if (!response.ok) {
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			body = null;
		}
		throw new TidalApiError(
			response.status,
			`Failed to fetch user favorites (${response.status})`,
			body,
			url
		);
	}

	const data = (await response.json()) as UserFavoritesRaw;

	const tracks = (data.TRACK ?? []).map(String);
	const albums = (data.ALBUM ?? []).map(String);
	const artists = (data.ARTIST ?? []).map(String);
	const playlists = (data.PLAYLIST ?? []).map(String);
	const videos = (data.VIDEO ?? []).map(String);

	return {
		tracks,
		albums,
		artists,
		playlists,
		videos,
		totalCount: tracks.length + albums.length + artists.length + playlists.length + videos.length
	};
}
