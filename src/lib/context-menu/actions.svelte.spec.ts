import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackSummary } from '#lib/tidal/models';

const navigation = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: navigation.goto, afterNavigate: () => {} }));

import {
	mediaActions,
	mediaPath,
	nowPlayingActions,
	queueEntryActions,
	trackActions
} from './actions';
import { player } from '#lib/player/player.svelte';
import { createQueueEntries } from '#lib/player/queue-entry';

const track: TrackSummary = {
	kind: 'track',
	id: '42',
	title: 'Answer',
	artists: [{ id: 'a1', name: 'Artist' }],
	album: { id: 'al1', title: 'Album' }
};
const ids = (actions: { id: string }[]) => actions.map((action) => action.id);

beforeEach(() => {
	navigation.goto.mockReset();
	player.queue = [];
});

describe('context actions', () => {
	it('routes to the same page on either site', () => {
		expect(mediaPath('album', '7', '/app/search')).toBe('/app/albums/7');
		expect(mediaPath('album', '7', '/search')).toBe('/albums/7');
	});

	it('offers a song everything from playing to sharing', () => {
		expect(ids(trackActions(track))).toEqual(
			expect.arrayContaining([
				'play-now',
				'play-next',
				'add-to-queue',
				'radio',
				'add-to-playlist',
				'album',
				'artist',
				'details',
				'copy-link'
			])
		);
	});

	it('does not offer catalogue links or radio for a private upload', () => {
		const upload = { ...track, id: 'upload:1', album: undefined, artists: [] };
		expect(ids(trackActions(upload))).toEqual([
			'play-now',
			'play-next',
			'add-to-queue',
			'add-to-playlist'
		]);
	});

	it('plays the selected occurrence through the surface’s own play behaviour', () => {
		const onPlayNow = vi.fn();
		trackActions(track, { onPlayNow })[0].onSelect();
		expect(onPlayNow).toHaveBeenCalledOnce();
	});

	it('never offers to restart the song playing now', () => {
		expect(ids(nowPlayingActions(track))).not.toContain('play-now');
	});

	it('disables moves past either end of the queue', () => {
		player.queue = createQueueEntries([track, { ...track, id: '43' }]);
		const first = queueEntryActions(player.queue[0]);
		const last = queueEntryActions(player.queue[1]);
		expect(first.find((a) => a.id === 'move-up')?.disabled).toBe(true);
		expect(first.find((a) => a.id === 'move-down')?.disabled).toBe(false);
		expect(last.find((a) => a.id === 'move-down')?.disabled).toBe(true);
		const remove = first.find((a) => a.id === 'remove')!;
		expect(remove.tone).toBe('danger');
		remove.onSelect();
		expect(player.queue.map((entry) => entry.id)).toEqual(['43']);
	});

	it('opens an album, artist or playlist where its card links', () => {
		const open = mediaActions('playlist', 'p1', 'Mix', '/app/playlists/p1');
		expect(ids(open).slice(0, 3)).toEqual(['open', 'open-new-tab', 'copy-link']);
		open[0].onSelect();
		expect(navigation.goto).toHaveBeenCalledWith('/app/playlists/p1');
	});
});
