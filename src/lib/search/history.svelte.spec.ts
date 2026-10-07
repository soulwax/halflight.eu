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
