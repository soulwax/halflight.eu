import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TrackReplacementDialog from './TrackReplacementDialog.svelte';
import { replacementOffer } from '#lib/player/replacement.svelte';
import { player } from '#lib/player/player.svelte';
import { customPlaylists } from '#lib/player/customPlaylists.svelte';
import { m } from '#lib/paraglide/messages.js';
import '../../../routes/layout.css';
vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn().mockResolvedValue(undefined),
	goto: vi.fn()
}));
const source = {
	kind: 'track' as const,
	id: '1',
	title: 'Unavailable song',
	artists: [{ id: 'a', name: 'Artist' }]
};
const candidate = {
	...source,
	id: '2',
	title: 'Playable song',
	duration: 240,
	album: { id: 'album', title: 'Album' }
};
const offer = {
	source,
	candidates: [{ track: candidate, match: 'best_fit' }],
	playlists: [{ id: 'saved', title: 'My playlist', version: 'version' }]
};
beforeEach(() => {
	replacementOffer.trackId = '1';
	player.currentTrack = source;
});
afterEach(async () => {
	replacementOffer.trackId = null;
	player.currentTrack = null;
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	await page.viewport(1280, 900);
});
describe('playable version chooser', () => {
	it('shows the match, lets the listener confirm a local replacement, and starts playback', async () => {
		await page.viewport(390, 844);
		const fetchMock = vi.fn(async (_url, init?: RequestInit) =>
			Response.json(init?.method === 'POST' ? { track: candidate } : offer)
		);
		vi.stubGlobal('fetch', fetchMock);
		const apply = vi.spyOn(player, 'applyRecordingReplacement').mockImplementation(() => {});
		const refresh = vi.spyOn(customPlaylists, 'syncWithServer').mockResolvedValue(undefined);
		render(TrackReplacementDialog);
		await expect.element(page.getByText(m.replacement_best_fit())).toBeInTheDocument();
		const accept = page.getByRole('button', { name: m.replacement_save_play() });
		await expect
			.poll(() => accept.element().getBoundingClientRect().height)
			.toBeGreaterThanOrEqual(48);
		await accept.click();
		await expect.poll(() => apply.mock.calls.length).toBe(1);
		expect(apply).toHaveBeenCalledWith('1', candidate, 'My playlist');
		expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({
			candidateId: '2',
			playlistId: 'saved',
			version: 'version'
		});
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(refresh).toHaveBeenCalledOnce();
	});
	it('keeps the song unchanged when the playlist changed and requires refreshing', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url, init?: RequestInit) =>
				init?.method === 'POST' ? new Response('', { status: 409 }) : Response.json(offer)
			)
		);
		const apply = vi.spyOn(player, 'applyRecordingReplacement').mockImplementation(() => {});
		render(TrackReplacementDialog);
		await page.getByRole('button', { name: m.replacement_save_play() }).click();
		await expect.element(page.getByRole('alert')).toHaveTextContent(m.replacement_changed());
		await expect
			.element(page.getByRole('button', { name: m.replacement_save_play() }))
			.toBeDisabled();
		expect(apply).not.toHaveBeenCalled();
	});
	it('offers playback only without writing a saved playlist', async () => {
		const fetchMock = vi.fn(async (_url, init?: RequestInit) =>
			Response.json(init?.method === 'POST' ? { track: candidate } : offer)
		);
		vi.stubGlobal('fetch', fetchMock);
		vi.spyOn(player, 'applyRecordingReplacement').mockImplementation(() => {});
		render(TrackReplacementDialog);
		await page.getByRole('combobox', { name: m.replacement_destination() }).selectOptions('');
		await page.getByRole('button', { name: m.replacement_play(), exact: true }).click();
		await expect.poll(() => fetchMock.mock.calls.length).toBe(2);
		expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({
			candidateId: '2',
			playlistId: null
		});
	});
	it('offers retry for a failed check rather than reporting no matching song', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection failed')));
		render(TrackReplacementDialog);
		await expect.element(page.getByRole('alert')).toHaveTextContent(m.replacement_failed());
		await expect.element(page.getByRole('button', { name: m.track_retry() })).toBeInTheDocument();
		await expect.element(page.getByText(m.replacement_empty())).not.toBeInTheDocument();
	});
});
