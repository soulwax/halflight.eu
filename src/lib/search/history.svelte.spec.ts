import { beforeEach, describe, expect, it } from 'vitest';
import { SearchHistory } from './history.svelte';
const track = (id: string) => ({
	kind: 'track' as const,
	id,
	title: `Song ${id}`,
	artists: [{ id: 'artist', name: 'Artist' }]
});
beforeEach(() => localStorage.clear());

describe('played search history', () => {
	it('merges reissues by valid ISRC and keeps the latest playable selection', () => {
		const history = new SearchHistory();
		history.setOwner('first');
		history.remember({ ...track('old'), isrc: 'US-ABC-12-34567' }, 'first');
		history.remember({ ...track('new'), isrc: 'USABC1234567' }, 'second');
		expect(history.entries.map(({ track }) => track.id)).toEqual(['new']);
		expect(history.entries[0].query).toBe('second');
	});
	it('cleans persisted duplicates, keeping the most recently played recording', () => {
		localStorage.setItem(
			'halflight:played-search:v1:first',
			JSON.stringify([
				{ track: { ...track('old'), isrc: 'USABC1234567' }, query: 'old', playedAt: 1 },
				{ track: { ...track('new'), isrc: 'USABC1234567' }, query: 'new', playedAt: 3 },
				{ track: track('other'), query: 'other', playedAt: 2 }
			])
		);
		const history = new SearchHistory();
		history.setOwner('first');
		expect(history.entries.map(({ track }) => track.id)).toEqual(['new', 'other']);
		expect(JSON.parse(localStorage.getItem('halflight:played-search:v1:first')!)).toHaveLength(2);
	});
	it('does not merge different recordings with malformed ISRCs', () => {
		const history = new SearchHistory();
		history.remember({ ...track('1'), isrc: '-' }, 'first');
		history.remember({ ...track('2'), isrc: '-' }, 'second');
		expect(history.entries).toHaveLength(2);
	});
	it('keeps unique songs newest first and persists them for their account only', () => {
		const history = new SearchHistory();
		history.setOwner('first');
		history.remember(track('1'), 'ambient');
		history.remember(track('2'), 'night');
		history.remember(track('1'), 'different search');
		expect(history.entries.map(({ track }) => track.id)).toEqual(['1', '2']);
		history.setOwner('second');
		expect(history.entries).toEqual([]);
		history.setOwner('first');
		expect(history.entries.map(({ track }) => track.id)).toEqual(['1', '2']);
	});
	it('does not migrate old query/result caches into played history', () => {
		localStorage.setItem('syn_search_history', JSON.stringify(['old query']));
		const history = new SearchHistory();
		history.setOwner('first');
		expect(history.entries).toEqual([]);
	});
	it('clears only this account’s played-search history', () => {
		const history = new SearchHistory();
		history.setOwner('first');
		history.remember(track('1'), 'ambient');
		history.remove('1');
		expect(history.entries).toEqual([]);
		history.remember(track('2'), 'night');
		history.clear();
		const restored = new SearchHistory();
		restored.setOwner('first');
		expect(restored.entries).toEqual([]);
	});
});
