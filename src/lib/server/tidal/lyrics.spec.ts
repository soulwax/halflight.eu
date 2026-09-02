import { describe, expect, it, vi } from 'vitest';
import { fetchTrackLyrics, parseLrc } from './lyrics';
import { TidalApiError } from './errors';

describe('lyrics parser and client (translated from tiddl)', () => {
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
