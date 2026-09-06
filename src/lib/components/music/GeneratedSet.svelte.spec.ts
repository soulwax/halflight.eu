import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { m } from '#lib/paraglide/messages.js';
import type { ProvisionalSet } from '#lib/taste/provisional';
import GeneratedSet from './GeneratedSet.svelte';

const set: ProvisionalSet = {
	summary: 'Set · 2 tracks',
	trackCount: 2,
	totalDurationFormatted: '7m',
	totalDurationSeconds: 420,
	discoveryPercentage: 50,
	confidenceLabel: 'High',
	degraded: false,
	generatedAt: '2026-09-06T12:00:00.000Z',
	tracks: [
		{
			id: 'first',
			title: 'First Track',
			artists: [{ id: 'artist', name: 'An Artist' }],
			duration: 210,
			provenance: 'Similar to An Artist'
		},
		{
			id: 'second',
			title: 'Second Track',
			artists: [{ id: 'artist', name: 'An Artist' }],
			duration: 210,
			provenance: 'Matched to your taste profile'
		}
	]
};

describe('GeneratedSet.svelte', () => {
	it('renders explainable tracks and forwards set actions', async () => {
		const onPlay = vi.fn();
		const onPlayTrack = vi.fn();
		const onSave = vi.fn();
		const onExport = vi.fn();

		await render(GeneratedSet, { set, onPlay, onPlayTrack, onSave, onExport });

		await expect
			.element(page.getByRole('heading', { name: m.generate_set_title() }))
			.toBeInTheDocument();
		await expect.element(page.getByText('Similar to An Artist')).toBeInTheDocument();
		await expect.element(page.getByText(m.generate_confidence_high())).toBeInTheDocument();

		await page.getByRole('button', { name: m.player_play_all() }).click();
		await page.getByRole('button', { name: `${m.player_play_track()}: First Track` }).click();
		await page.getByRole('button', { name: m.playlist_save() }).click();
		await page.getByRole('button', { name: m.action_export_m3u8() }).click();

		expect(onPlay).toHaveBeenCalledOnce();
		expect(onPlayTrack).toHaveBeenCalledWith(set.tracks[0]);
		expect(onSave).toHaveBeenCalledOnce();
		expect(onExport).toHaveBeenCalledOnce();
	}, 30_000);
});
