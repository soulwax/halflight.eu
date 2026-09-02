import { describe, expect, it, vi } from 'vitest';
import { fetchAlbumReview, normalizeReviewText } from './review';
import { TidalApiError } from './errors';

describe('album review module (translated from tiddl)', () => {
	it('normalizes empty or null review text', () => {
		expect(normalizeReviewText('')).toBe('');
		expect(normalizeReviewText(null)).toBe('');
		expect(normalizeReviewText(undefined)).toBe('');
	});

	it('strips WiMP tags and preserves inner text', () => {
		const raw =
			'This iconic album by [wimpLink artistId="123"]Daft Punk[/wimpLink] features classic tracks like [wimpLink trackId="456"]Get Lucky[/wimpLink].';
		const normalized = normalizeReviewText(raw);
		expect(normalized).toBe(
			'This iconic album by Daft Punk features classic tracks like Get Lucky.'
		);
	});

	it('cleans unmatched or empty wimpLink tags', () => {
		const raw = '[wimpLink]Broken link[/wimpLink] and [wimpLink standalone]';
		expect(normalizeReviewText(raw)).toBe('Broken link and');
	});

	it('fetches album review and returns normalized fields', async () => {
		const mockData = {
			source: 'Pitchfork',
			lastUpdated: '2023-01-01',
			summary: 'A masterpiece from [wimpLink artistId="1"]Pink Floyd[/wimpLink].',
			text: 'Full review text praising [wimpLink albumId="2"]The Dark Side of the Moon[/wimpLink].'
		};

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockData
		});

		const result = await fetchAlbumReview('123', {
			accessToken: 'token-abc',
			ctx: { fetch: fetchMock as unknown as typeof fetch }
		});

		expect(result).not.toBeNull();
		expect(result?.source).toBe('Pitchfork');
		expect(result?.summary).toBe('A masterpiece from Pink Floyd.');
		expect(result?.normalizedText).toBe('Full review text praising The Dark Side of the Moon.');
	});

	it('returns null when review is 404', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
			json: async () => ({ status: 404 })
		});

		const result = await fetchAlbumReview('unknown-album', {
			accessToken: 'token-abc',
			ctx: { fetch: fetchMock as unknown as typeof fetch }
		});

		expect(result).toBeNull();
	});

	it('throws on other API errors', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({ status: 500, userMessage: 'Server error' })
		});

		await expect(
			fetchAlbumReview('123', {
				accessToken: 'token-abc',
				ctx: { fetch: fetchMock as unknown as typeof fetch }
			})
		).rejects.toThrow(TidalApiError);
	});
});
