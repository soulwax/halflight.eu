import { TidalApiError } from './errors';
import { getAccessToken, type TidalRequestContext } from './client';

export interface LyricCue {
	time: number;
	text: string;
}

export interface TrackLyricsResponse {
	trackId: number;
	lyrics: string;
	subtitles?: string;
	isRightToLeft?: boolean;
	lyricsProvider?: string;
	providerCommontrackId?: string;
	providerLyricsId?: string;
}

export interface ParsedTrackLyrics {
	trackId: number;
	lyrics: string;
	subtitles?: string;
	cues: LyricCue[];
	isRightToLeft: boolean;
	lyricsProvider: string;
}

/**
 * Parses LRC formatted lyrics (e.g. `[01:23.45] lyric text`) into structured, timestamped cues.
 */
export function parseLrc(lrcContent: string | null | undefined): LyricCue[] {
	if (!lrcContent) return [];

	const lines = lrcContent.split(/\r?\n/);
	const cues: LyricCue[] = [];

	// Match timestamp tag: [mm:ss.xx] or [mm:ss.xxx] or [m:s.xx]
	const tagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const timestamps: number[] = [];
		let match: RegExpExecArray | null;

		while ((match = tagRegex.exec(trimmed)) !== null) {
			const minutes = parseInt(match[1], 10);
			const seconds = parseInt(match[2], 10);
			let ms = 0;
			if (match[3]) {
				if (match[3].length === 1) ms = parseInt(match[3], 10) * 100;
				else if (match[3].length === 2) ms = parseInt(match[3], 10) * 10;
				else ms = parseInt(match[3].slice(0, 3), 10);
			}
			timestamps.push(minutes * 60 + seconds + ms / 1000);
		}

		const text = trimmed.replace(tagRegex, '').trim();
		for (const time of timestamps) {
			cues.push({ time, text });
		}
	}

	return cues.sort((a, b) => a.time - b.time);
}

/**
 * Fetches track lyrics and parsed timestamped subtitles from TIDAL v1 API.
 * Translates tiddl/core/api/api.py:get_track_lyrics.
 */
export async function fetchTrackLyrics(
	trackId: string | number,
	options: {
		ctx?: TidalRequestContext;
		accessToken?: string;
		countryCode?: string;
	} = {}
): Promise<ParsedTrackLyrics> {
	const token = options.accessToken ?? (await getAccessToken(options.ctx));
	const f = options.ctx?.fetch ?? fetch;

	const query = options.countryCode
		? `?countryCode=${encodeURIComponent(options.countryCode)}`
		: '';
	const url = `https://api.tidal.com/v1/tracks/${encodeURIComponent(String(trackId))}/lyrics${query}`;

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
		const errObj = body as { status?: number; subStatus?: number; userMessage?: string } | null;
		throw new TidalApiError(
			response.status,
			errObj?.userMessage || response.statusText,
			errObj,
			url
		);
	}

	const data = (await response.json()) as TrackLyricsResponse;
	const cues = parseLrc(data.subtitles);

	return {
		trackId: data.trackId,
		lyrics: data.lyrics || '',
		subtitles: data.subtitles,
		cues,
		isRightToLeft: Boolean(data.isRightToLeft),
		lyricsProvider: data.lyricsProvider || 'TIDAL'
	};
}
