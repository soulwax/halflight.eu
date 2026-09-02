import { getPlaybackToken, type TidalRequestContext } from './client';
import { TidalApiError } from './errors';

export interface Contributor {
	id?: number | string;
	name: string;
	role?: string;
}

export interface CreditEntry {
	type: string;
	contributors: Contributor[];
}

export interface TrackCreditItem {
	item: {
		id: number | string;
		title?: string;
	};
	credits: CreditEntry[];
}

export interface AlbumCreditsResponse {
	limit: number;
	offset: number;
	totalNumberOfItems: number;
	items: TrackCreditItem[];
}

/**
 * Fetches contributors and production credits for all tracks on an album from TIDAL v1 API.
 * Translates tiddl/core/api/api.py:get_album_items_credits.
 */
export async function fetchAlbumCredits(
	albumId: string | number,
	options: {
		ctx?: TidalRequestContext;
		accessToken?: string;
		countryCode?: string;
		limit?: number;
		offset?: number;
	} = {}
): Promise<TrackCreditItem[]> {
	const token = options.accessToken ?? (await getPlaybackToken(options.ctx));
	const f = options.ctx?.fetch ?? fetch;

	const params = new URLSearchParams();
	if (options.countryCode) params.set('countryCode', options.countryCode);
	if (options.limit) params.set('limit', String(Math.min(options.limit, 100)));
	if (options.offset) params.set('offset', String(options.offset));

	const query = params.toString() ? `?${params.toString()}` : '';
	const url = `https://api.tidal.com/v1/albums/${encodeURIComponent(String(albumId))}/items/credits${query}`;

	const response = await f(url, {
		headers: {
			authorization: `Bearer ${token}`,
			accept: 'application/json'
		}
	});

	if (response.status === 404) {
		return [];
	}

	if (!response.ok) {
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			body = null;
		}
		throw new TidalApiError(
			response.status,
			`Failed to fetch album credits (${response.status})`,
			body,
			url
		);
	}

	const data = (await response.json()) as AlbumCreditsResponse;
	return data.items || [];
}
