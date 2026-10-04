import { redisCache, type EphemeralCache } from '#lib/server/cache';
import { TidalApiError } from './errors';
import { getPlaybackToken, type TidalRequestContext } from './client';

export interface LyricCue {
	time: number;
	text: string;
}

export interface TrackLyricsResponse {
	trackId: number | string;
	lyrics: string;
	subtitles?: string;
	isRightToLeft?: boolean;
	lyricsProvider?: string;
	providerCommontrackId?: string;
	providerLyricsId?: string;
}

export interface ParsedTrackLyrics {
	trackId: number | string;
	lyrics: string;
	subtitles?: string;
	cues: LyricCue[];
	isRightToLeft: boolean;
	lyricsProvider: string;
}

export interface LrclibLyricsResponse {
	id?: number;
	name?: string;
	trackName?: string;
	artistName?: string;
	albumName?: string;
	duration?: number;
	instrumental?: boolean;
	plainLyrics?: string;
	syncedLyrics?: string;
}

export interface FallbackLyricsOptions {
	title?: string;
	artist?: string;
	album?: string;
	duration?: number;
	ctx?: TidalRequestContext;
	fetchFn?: typeof fetch;
	cache?: EphemeralCache;
}

export interface ResolveTrackLyricsOptions extends FallbackLyricsOptions {
	accessToken?: string;
	countryCode?: string;
}

const MAX_L1_ENTRIES = 200;
const L1_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
	lyrics: ParsedTrackLyrics;
	expiresAt: number;
}

const l1LyricsCache = new Map<string, CacheEntry>();
const lyricsInFlight = new Map<string, Promise<ParsedTrackLyrics | null>>();

export function __resetLyricsCache(): void {
	l1LyricsCache.clear();
	lyricsInFlight.clear();
}

function getL1(key: string): ParsedTrackLyrics | null {
	const entry = l1LyricsCache.get(key);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) {
		l1LyricsCache.delete(key);
		return null;
	}
	return entry.lyrics;
}

function setL1(key: string, lyrics: ParsedTrackLyrics): void {
	if (l1LyricsCache.size >= MAX_L1_ENTRIES) {
		const oldest = l1LyricsCache.keys().next().value;
		if (oldest !== undefined) l1LyricsCache.delete(oldest);
	}
	l1LyricsCache.set(key, { lyrics, expiresAt: Date.now() + L1_TTL_MS });
}

async function getCachedLyrics(
	key: string,
	cache: EphemeralCache = redisCache
): Promise<ParsedTrackLyrics | null> {
	const l1 = getL1(key);
	if (l1) return l1;

	try {
		const raw = await cache.get(`lyrics:${key}`);
		if (raw) {
			const parsed = JSON.parse(raw) as ParsedTrackLyrics;
			setL1(key, parsed);
			return parsed;
		}
	} catch {
		// Fail-open
	}

	return null;
}

async function setCachedLyrics(
	key: string,
	lyrics: ParsedTrackLyrics,
	cache: EphemeralCache = redisCache
): Promise<void> {
	setL1(key, lyrics);
	try {
		await cache.set(`lyrics:${key}`, JSON.stringify(lyrics), 300);
	} catch {
		// Fail-open
	}
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
 * Strips LRC timestamp tags to produce plain text lyrics.
 */
export function stripLrc(lrcContent: string | null | undefined): string {
	if (!lrcContent) return '';
	const tagRegex = /\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g;
	return lrcContent
		.split(/\r?\n/)
		.map((line) => line.replace(tagRegex, '').trim())
		.filter((line) => line.length > 0)
		.join('\n');
}

/**
 * Normalises a track title by removing extraneous metadata tags like
 * remastered notices, live recordings, featuring artists, and radio edits
 * to maximize lookup success in public community databases.
 */
export function cleanTrackTitle(title: string): string {
	return title
		.replace(
			/\s*[-—–]\s*(?:(?:\d{4}\s*)?remaster(?:ed)?(?:\s*(?:version|\d{4}))?|live.*|single version|radio edit|album version|original mix|bonus track)\b.*/i,
			''
		)
		.replace(
			/\s*[([](?:(?:\d{4}\s*)?remaster(?:ed)?(?:\s*(?:version|\d{4}))?|live.*|single version|radio edit|album version|original mix|bonus track|feat(?:uring)?\.?.*)[)\]]/gi,
			''
		)
		.replace(/\s+feat(?:uring)?\.?\s+.*/i, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

/**
 * Normalises an artist string by extracting the primary artist name.
 */
export function cleanArtistName(artist: string): string {
	return artist
		.split(/[,/&]|(?:\s+feat(?:uring)?\.?\s+)/i)[0]
		.replace(/\s{2,}/g, ' ')
		.trim();
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
	const token = options.accessToken ?? (await getPlaybackToken(options.ctx));
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

function formatLrclibResponse(
	data: LrclibLyricsResponse,
	trackId: string | number
): ParsedTrackLyrics | null {
	if (data.instrumental) {
		return {
			trackId,
			lyrics: '♪ Instrumental ♪',
			subtitles: undefined,
			cues: [],
			isRightToLeft: false,
			lyricsProvider: 'LRCLIB'
		};
	}

	const synced = data.syncedLyrics?.trim();
	const plain = data.plainLyrics?.trim();

	if (!synced && !plain) return null;

	const cues = synced ? parseLrc(synced) : [];
	const lyrics = plain || (synced ? stripLrc(synced) : '');

	return {
		trackId,
		lyrics,
		subtitles: synced || undefined,
		cues,
		isRightToLeft: false,
		lyricsProvider: 'LRCLIB'
	};
}

/**
 * Fetches lyrics from LRCLIB using exact match, cleaned metadata match, or search.
 */
export async function fetchLrclibLyrics(
	trackId: string | number,
	options: {
		title: string;
		artist: string;
		album?: string;
		duration?: number;
		fetchFn?: typeof fetch;
	}
): Promise<ParsedTrackLyrics | null> {
	const f = options.fetchFn ?? fetch;
	const title = options.title.trim();
	const artist = options.artist.trim();
	if (!title || !artist) return null;

	const headers = {
		'User-Agent': 'Syn Music Player (https://github.com/soulwax/Syn)',
		accept: 'application/json'
	};

	// 1. Exact match attempt
	try {
		const params = new URLSearchParams({
			track_name: title,
			artist_name: artist
		});
		if (options.album) params.set('album_name', options.album);
		if (options.duration && options.duration > 0) {
			params.set('duration', String(Math.round(options.duration)));
		}

		const res = await f(`https://lrclib.net/api/get?${params.toString()}`, {
			headers,
			signal: AbortSignal.timeout(3000)
		});

		if (res.ok) {
			const data = (await res.json().catch(() => null)) as LrclibLyricsResponse | null;
			if (data) {
				const formatted = formatLrclibResponse(data, trackId);
				if (formatted) return formatted;
			}
		}
	} catch {
		// Fall through to relaxed attempt
	}

	// 2. Cleaned title & artist attempt
	const cleanedTitle = cleanTrackTitle(title);
	const cleanedArtist = cleanArtistName(artist);
	if (cleanedTitle !== title || cleanedArtist !== artist) {
		try {
			const params = new URLSearchParams({
				track_name: cleanedTitle,
				artist_name: cleanedArtist
			});
			const res = await f(`https://lrclib.net/api/get?${params.toString()}`, {
				headers,
				signal: AbortSignal.timeout(3000)
			});

			if (res.ok) {
				const data = (await res.json().catch(() => null)) as LrclibLyricsResponse | null;
				if (data) {
					const formatted = formatLrclibResponse(data, trackId);
					if (formatted) return formatted;
				}
			}
		} catch {
			// Fall through to search attempt
		}
	}

	// 3. Search attempt
	try {
		const query = `${cleanedTitle} ${cleanedArtist}`.trim();
		const res = await f(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
			headers,
			signal: AbortSignal.timeout(3000)
		});

		if (res.ok) {
			const items = (await res.json().catch(() => null)) as LrclibLyricsResponse[] | null;
			if (Array.isArray(items) && items.length > 0) {
				const normalizedArtist = cleanedArtist.toLowerCase();
				const match = items.find((item) => {
					const itemArtist = (item.artistName || '').toLowerCase();
					return (
						(itemArtist.includes(normalizedArtist) || normalizedArtist.includes(itemArtist)) &&
						(item.instrumental ||
							(item.syncedLyrics && item.syncedLyrics.trim().length > 0) ||
							(item.plainLyrics && item.plainLyrics.trim().length > 0))
					);
				});
				if (match) {
					const formatted = formatLrclibResponse(match, trackId);
					if (formatted) return formatted;
				}
			}
		}
	} catch {
		// Search failed
	}

	return null;
}

/**
 * Fetches plain lyrics from Lyrics.ovh as a secondary text fallback.
 */
export async function fetchLyricsOvh(
	trackId: string | number,
	options: {
		title: string;
		artist: string;
		fetchFn?: typeof fetch;
	}
): Promise<ParsedTrackLyrics | null> {
	const f = options.fetchFn ?? fetch;
	const title = cleanTrackTitle(options.title.trim());
	const artist = cleanArtistName(options.artist.trim());
	if (!title || !artist) return null;

	try {
		const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
		const res = await f(url, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(3000)
		});

		if (res.ok) {
			const data = (await res.json().catch(() => null)) as { lyrics?: string } | null;
			if (data?.lyrics && data.lyrics.trim().length > 0) {
				return {
					trackId,
					lyrics: data.lyrics.trim(),
					cues: [],
					isRightToLeft: false,
					lyricsProvider: 'Lyrics.ovh'
				};
			}
		}
	} catch {
		// Failed
	}

	return null;
}

/**
 * Resolves lyrics across community fallback providers (LRCLIB, Lyrics.ovh)
 * when TIDAL does not have lyrics for a track.
 */
export async function resolveLyricsFallbacks(
	trackId: string | number,
	options: FallbackLyricsOptions = {}
): Promise<ParsedTrackLyrics | null> {
	const cache = options.cache ?? redisCache;
	const key = String(trackId);
	const cached = await getCachedLyrics(key, cache);
	if (cached) return cached;

	const title = options.title?.trim();
	const artist = options.artist?.trim();
	if (!title || !artist) return null;

	const f = options.ctx?.fetch ?? options.fetchFn ?? fetch;

	// Fallback 1: LRCLIB (synced + plain)
	const lrclib = await fetchLrclibLyrics(trackId, {
		title,
		artist,
		album: options.album,
		duration: options.duration,
		fetchFn: f
	});
	if (lrclib) {
		await setCachedLyrics(key, lrclib, cache);
		return lrclib;
	}

	// Fallback 2: Lyrics.ovh (plain lyrics)
	const ovh = await fetchLyricsOvh(trackId, {
		title,
		artist,
		fetchFn: f
	});
	if (ovh) {
		await setCachedLyrics(key, ovh, cache);
		return ovh;
	}

	return null;
}

/**
 * Multi-tier lyrics orchestrator:
 * L1 in-memory -> L2 Redis -> TIDAL v1 API -> LRCLIB -> Lyrics.ovh.
 * Single-flight deduplication ensures concurrent requests collapse into one.
 */
export async function resolveTrackLyrics(
	trackId: string | number,
	options: ResolveTrackLyricsOptions = {}
): Promise<ParsedTrackLyrics | null> {
	const cache = options.cache ?? redisCache;
	const key = String(trackId);
	const cached = await getCachedLyrics(key, cache);
	if (cached) return cached;

	const pending = lyricsInFlight.get(key);
	if (pending) return pending;

	const promise = (async () => {
		try {
			// Tier 1: TIDAL v1 API if trackId looks like a TIDAL ID
			if (/^\d+$/.test(key)) {
				try {
					const tidalLyrics = await fetchTrackLyrics(trackId, options);
					if (
						tidalLyrics &&
						(tidalLyrics.lyrics.trim().length > 0 || tidalLyrics.cues.length > 0)
					) {
						await setCachedLyrics(key, tidalLyrics, cache);
						return tidalLyrics;
					}
				} catch {
					// Fall through to fallbacks
				}
			}

			// Tier 2+: Fallbacks using metadata
			return await resolveLyricsFallbacks(trackId, options);
		} finally {
			lyricsInFlight.delete(key);
		}
	})();

	lyricsInFlight.set(key, promise);
	return promise;
}
