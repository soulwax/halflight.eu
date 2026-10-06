import { describe, expect, it } from 'vitest';
import { MobileSearchSession } from './search-session.svelte';

describe('MobileSearchSession', () => {
	it('keeps the most recent result set for the current mobile layout lifetime', () => {
		const session = new MobileSearchSession();
		const results = { tracks: [], albums: [], artists: [], playlists: [] };
		session.remember('  late night  ', results);
		expect(session.lastQuery).toBe('late night');
		expect(session.lastResults).toBe(results);
	});

	it('does not replace useful results with an empty query', () => {
		const session = new MobileSearchSession();
		const results = { tracks: [], albums: [], artists: [], playlists: [] };
		session.remember('ambient', results);
		session.remember(' ', { tracks: [], albums: [], artists: [], playlists: [] });
		expect(session.lastQuery).toBe('ambient');
		expect(session.lastResults).toBe(results);
	});
});
