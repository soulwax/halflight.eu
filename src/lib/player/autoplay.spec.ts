import { describe, expect, it } from 'vitest';
import type { TrackSummary } from '#lib/tidal/models';
import { autoplayRequestBody, freshSuggestions, readSuggestedTracks } from './autoplay';

const track = (id: string, title = `Song ${id}`): TrackSummary => ({
	kind: 'track',
	id,
	title,
	artists: [{ id: `a${id}`, name: `Artist ${id}` }]
});

describe('autoplay request', () => {
	it('seeds from the current song and the most recent distinct ones before it', () => {
		const body = autoplayRequestBody(
			track('5'),
			[track('1'), track('2'), track('5'), track('4')],
			[]
		);
		expect(body?.seeds.map((seed) => seed.id)).toEqual(['5', '4', '2']);
	});

	it('excludes everything queued, playing and heard, once each', () => {
		const body = autoplayRequestBody(track('3'), [track('1'), track('1')], [track('9')]);
		expect(body?.exclude.map((known) => known.id)).toEqual(['9', '3', '1']);
		expect(body?.exclude[0]).toEqual({ id: '9', title: 'Song 9', artist: 'Artist 9' });
	});

	it('skips private uploads and other non-catalogue IDs', () => {
		expect(autoplayRequestBody(track('upload:abc'), [], [])).toBeNull();
	});
});

describe('autoplay results', () => {
	it('drops songs that reached the session while the request was in flight, and repeats', () => {
		expect(
			freshSuggestions([track('1'), track('2'), track('2'), track('3')], [track('1')]).map(
				(t) => t.id
			)
		).toEqual(['2', '3']);
	});

	it('accepts only well-formed tracks from the response', () => {
		expect(readSuggestedTracks({ tracks: [track('1'), { id: 2 }, null] })).toEqual([track('1')]);
		expect(readSuggestedTracks(null)).toEqual([]);
	});
});
