import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	__resetLyricsCache,
	cleanArtistName,
	cleanTrackTitle,
	fetchLrclibLyrics,
	fetchLyricsOvh,
	fetchTrackLyrics,
	parseLrc,
	resolveLyricsFallbacks,
	resolveTrackLyrics,
	stripLrc
} from './lyrics';
import type { EphemeralCache } from '#lib/server/cache';
import { TidalApiError } from './errors';

function createMemoryCache(): EphemeralCache {
	const map = new Map<string, string>();
	return {
		async get(k: string) {
			return map.get(k) ?? null;
		},
		async set(k: string, v: string) {
			map.set(k, v);
		},
		async delete(k: string) {
			map.delete(k);
		}
	};
}

describe('lyrics parser and client (translated from tiddl)', () => {
	beforeEach(() => {
		__resetLyricsCache();
	});

	it('parses empty or missing LRC string to empty cues', () => {
		expect(parseLrc('')).toEqual([]);
		expect(parseLrc(null)).toEqual([]);
		expect(parseLrc(undefined)).toEqual([]);
	});

	it('parses standard LRC timestamps into sorted cues with seconds', () => {
		const lrc = `
			[00:05.12] First line of song
			[00:15.500] Second line of song
			[01:02.00] Chorus begins
		`;

		const cues = parseLrc(lrc);
		expect(cues).toHaveLength(3);
		expect(cues[0]).toEqual({ time: 5.12, text: 'First line of song' });
		expect(cues[1]).toEqual({ time: 15.5, text: 'Second line of song' });
		expect(cues[2]).toEqual({ time: 62, text: 'Chorus begins' });
	});

	it('handles multi-timestamp lines and sorts chronologically', () => {
		const lrc = `
			[01:00.00] Line at one minute
			[00:10.00][00:20.00] Repeated hook
		`;

		const cues = parseLrc(lrc);
		expect(cues).toHaveLength(3);
		expect(cues[0]).toEqual({ time: 10, text: 'Repeated hook' });
		expect(cues[1]).toEqual({ time: 20, text: 'Repeated hook' });
		expect(cues[2]).toEqual({ time: 60, text: 'Line at one minute' });
	});

	it('applies LRC millisecond offsets before sorting cues', () => {
		expect(parseLrc('[offset:+1500]\n[00:02.00] later\n[00:01.00] earlier')).toEqual([
			{ time: 2.5, text: 'earlier' },
			{ time: 3.5, text: 'later' }
		]);
		expect(parseLrc('[offset:-2500]\n[00:01.00] begins at zero')).toEqual([
			{ time: 0, text: 'begins at zero' }
		]);
	});

	it('fetches track lyrics and parses cues', async () => {
		const mockApiResponse = {
			trackId: 12345,
			lyrics: 'Line 1\nLine 2',
			subtitles: '[00:01.00] Line 1\n[00:05.50] Line 2',
			isRightToLeft: false,
			lyricsProvider: 'Musixmatch'
		};

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockApiResponse
		});

		const result = await fetchTrackLyrics(12345, {
			accessToken: 'token-abc',
			ctx: { fetch: fetchMock as unknown as typeof fetch }
		});

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.tidal.com/v1/tracks/12345/lyrics',
			expect.objectContaining({
				headers: {
					authorization: 'Bearer token-abc',
					accept: 'application/json'
				}
			})
		);

		expect(result.trackId).toBe(12345);
		expect(result.lyrics).toBe('Line 1\nLine 2');
		expect(result.cues).toHaveLength(2);
		expect(result.cues[0]).toEqual({ time: 1, text: 'Line 1' });
		expect(result.cues[1]).toEqual({ time: 5.5, text: 'Line 2' });
	});

	it('throws TidalApiError on non-ok response', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
			json: async () => ({ status: 404, userMessage: 'Lyrics not found' })
		});

		await expect(
			fetchTrackLyrics(999, {
				accessToken: 'token-abc',
				ctx: { fetch: fetchMock as unknown as typeof fetch }
			})
		).rejects.toThrow(TidalApiError);
	});
});

describe('lyrics text manipulation & metadata normalisation', () => {
	it('stripLrc strips all LRC timestamps and returns clean plain text', () => {
		expect(stripLrc('')).toBe('');
		expect(stripLrc(null)).toBe('');
		expect(stripLrc(undefined)).toBe('');

		const lrc = `
			[00:05.12] First line of song
			[00:15.500] Second line of song
			[01:02.00] Chorus begins
		`;
		expect(stripLrc(lrc)).toBe('First line of song\nSecond line of song\nChorus begins');
	});

	it('cleanTrackTitle strips remaster, live, and featuring tags', () => {
		expect(cleanTrackTitle('Heroes - 2017 Remaster')).toBe('Heroes');
		expect(cleanTrackTitle('Life on Mars? (2015 Remastered Version)')).toBe('Life on Mars?');
		expect(cleanTrackTitle('Under Pressure (feat. David Bowie)')).toBe('Under Pressure');
		expect(cleanTrackTitle('Song Name feat. Someone Else')).toBe('Song Name');
		expect(cleanTrackTitle('Rock You (Live at Wembley)')).toBe('Rock You');
		expect(cleanTrackTitle('Pure Track Title')).toBe('Pure Track Title');
	});

	it('cleanArtistName extracts the primary artist', () => {
		expect(cleanArtistName('Queen feat. David Bowie')).toBe('Queen');
		expect(cleanArtistName('Daft Punk & Pharrell Williams')).toBe('Daft Punk');
		expect(cleanArtistName('Kraftwerk, Karl Bartos')).toBe('Kraftwerk');
		expect(cleanArtistName('Underworld / Iggy Pop')).toBe('Underworld');
		expect(cleanArtistName('Depeche Mode')).toBe('Depeche Mode');
	});
});

describe('lyrics fallback providers', () => {
	beforeEach(() => {
		__resetLyricsCache();
	});

	it('fetchLrclibLyrics handles exact match with synced cues', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				trackName: 'Heroes',
				artistName: 'David Bowie',
				syncedLyrics: '[00:01.00] I, I will be king\n[00:05.00] And you, you will be queen',
				plainLyrics: 'I, I will be king\nAnd you, you will be queen',
				instrumental: false
			})
		});

		const res = await fetchLrclibLyrics(100, {
			title: 'Heroes',
			artist: 'David Bowie',
			fetchFn: fetchMock as unknown as typeof fetch
		});

		expect(res).not.toBeNull();
		expect(res?.lyricsProvider).toBe('LRCLIB');
		expect(res?.cues).toHaveLength(2);
		expect(res?.cues[0]).toEqual({ time: 1, text: 'I, I will be king' });
		expect(res?.lyrics).toContain('I, I will be king');
	});

	it('fetchLrclibLyrics handles instrumental tracks', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				instrumental: true
			})
		});

		const res = await fetchLrclibLyrics(200, {
			title: 'Orion',
			artist: 'Metallica',
			fetchFn: fetchMock as unknown as typeof fetch
		});

		expect(res).not.toBeNull();
		expect(res?.lyrics).toBe('♪ Instrumental ♪');
		expect(res?.cues).toHaveLength(0);
	});

	it('fetchLrclibLyrics falls back to search query when exact match fails', async () => {
		const fetchMock = vi
			.fn()
			// Exact match 404
			.mockResolvedValueOnce({ ok: false, status: 404 })
			// Search 200
			.mockResolvedValueOnce({
				ok: true,
				json: async () => [
					{
						trackName: 'Starman',
						artistName: 'David Bowie',
						syncedLyrics: '[00:10.00] There is a starman waiting in the sky',
						instrumental: false
					}
				]
			});

		const res = await fetchLrclibLyrics(300, {
			title: 'Starman',
			artist: 'David Bowie',
			fetchFn: fetchMock as unknown as typeof fetch
		});

		expect(res).not.toBeNull();
		expect(res?.cues[0].text).toBe('There is a starman waiting in the sky');
	});

	it('fetchLyricsOvh fetches plain text lyrics', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				lyrics: 'This is ground control to Major Tom'
			})
		});

		const res = await fetchLyricsOvh(400, {
			title: 'Space Oddity',
			artist: 'David Bowie',
			fetchFn: fetchMock as unknown as typeof fetch
		});

		expect(res).not.toBeNull();
		expect(res?.lyricsProvider).toBe('Lyrics.ovh');
		expect(res?.lyrics).toBe('This is ground control to Major Tom');
		expect(res?.cues).toHaveLength(0);
	});

	it('resolveLyricsFallbacks cascades through providers and caches result', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				syncedLyrics: '[00:03.00] Ch-ch-changes',
				plainLyrics: 'Ch-ch-changes',
				instrumental: false
			})
		});
		const cache = createMemoryCache();

		// First call hits fetch
		const first = await resolveLyricsFallbacks(500, {
			title: 'Changes',
			artist: 'David Bowie',
			fetchFn: fetchMock as unknown as typeof fetch,
			cache
		});

		expect(first).not.toBeNull();
		expect(first?.lyricsProvider).toBe('LRCLIB');
		expect(fetchMock).toHaveBeenCalledTimes(1);

		// Second call for same track hits memory cache without fetching
		const second = await resolveLyricsFallbacks(500, {
			title: 'Changes',
			artist: 'David Bowie',
			fetchFn: fetchMock as unknown as typeof fetch,
			cache
		});

		expect(second).toEqual(first);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('resolveTrackLyrics tries TIDAL and falls back to LRCLIB on error', async () => {
		// Mock TIDAL failing with 404, then LRCLIB succeeding
		const fetchMock = vi
			.fn()
			// TIDAL call
			.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: async () => ({ status: 404, userMessage: 'No TIDAL lyrics' })
			})
			// LRCLIB call
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					syncedLyrics: '[00:02.00] Ziggy played guitar',
					plainLyrics: 'Ziggy played guitar',
					instrumental: false
				})
			});

		const res = await resolveTrackLyrics(600, {
			title: 'Ziggy Stardust',
			artist: 'David Bowie',
			accessToken: 'token-abc',
			ctx: { fetch: fetchMock as unknown as typeof fetch },
			cache: createMemoryCache()
		});

		expect(res).not.toBeNull();
		expect(res?.lyricsProvider).toBe('LRCLIB');
		expect(res?.lyrics).toContain('Ziggy played guitar');
	});
});
it('keeps millisecond cue boundaries and ignores malformed seconds', () => {
	expect(parseLrc('[00:60.123] malformed\n[00:01.125] exact')).toEqual([
		{ time: 1.125, text: 'exact' }
	]);
});
