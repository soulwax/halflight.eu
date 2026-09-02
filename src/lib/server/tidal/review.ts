import { TidalApiError } from './errors';
import { getAccessToken, type TidalRequestContext } from './client';

export interface AlbumReviewRaw {
	source?: string;
	lastUpdated?: string;
	text?: string;
	summary?: string;
}

export interface AlbumReview {
	source: string;
	lastUpdated: string;
	summary: string;
	text: string;
	normalizedText: string;
}

/**
 * Strips legacy WiMP link tags `[wimpLink ...][/wimpLink]` from TIDAL editorial review text.
 * Translates tiddl/core/api/models/review.py:normalize_review_text.
 */
export function normalizeReviewText(text: string | null | undefined): string {
	if (!text) return '';

	let cleaned = text.replace(/\[wimpLink\b[^\]]*\]([\s\S]*?)\[\/wimpLink\]/gi, '$1');
	cleaned = cleaned.replace(/\[\/?wimpLink\b[^\]]*\]/gi, '');

	return cleaned.trim();
}

/**
 * Fetches the official editorial album review from TIDAL v1 API.
 * Translates tiddl/core/api/api.py:get_album_review.
 */
export async function fetchAlbumReview(
	albumId: string | number,
	options: {
		ctx?: TidalRequestContext;
		accessToken?: string;
		countryCode?: string;
	} = {}
): Promise<AlbumReview | null> {
	const token = options.accessToken ?? (await getAccessToken(options.ctx));
	const f = options.ctx?.fetch ?? fetch;

	const query = options.countryCode
		? `?countryCode=${encodeURIComponent(options.countryCode)}`
		: '';
	const url = `https://api.tidal.com/v1/albums/${encodeURIComponent(String(albumId))}/review${query}`;

	const response = await f(url, {
		headers: {
			authorization: `Bearer ${token}`,
			accept: 'application/json'
		}
	});

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			body = null;
		}
		const errObj = body as { status?: number; subStatus?: number; userMessage?: string } | null;
		throw new TidalApiError(
			response.status,
			errObj?.userMessage || response.statusText,
			errObj,
			url
		);
	}

	const data = (await response.json()) as AlbumReviewRaw;

	return {
		source: data.source || 'TIDAL Editorial',
		lastUpdated: data.lastUpdated || '',
		summary: normalizeReviewText(data.summary),
		text: data.text || '',
		normalizedText: normalizeReviewText(data.text)
	};
}
