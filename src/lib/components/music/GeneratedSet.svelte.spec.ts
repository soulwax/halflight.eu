import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { m } from '#lib/paraglide/messages.js';
import type { ProvisionalSet } from '#lib/taste/provisional';
import GeneratedSet from './GeneratedSet.svelte';

const set: ProvisionalSet = {
	trackCount: 2,
	knownDurationSeconds: 210,
	unknownDurationCount: 1,
	estimatedDurationSeconds: 420,
	discoveryPercentage: 50,
	confidenceLabel: 'high',
	degraded: false,
	generatedAt: '2026-09-06T12:00:00.000Z',
	tracks: [
		{
			id: 'first',
			title: 'First Track',
			artists: [{ id: 'artist', name: 'An Artist' }],
			duration: 210,
			reason: {
				code: 'similar_artist',
				seedArtistId: 'artist',
				seedArtistName: 'An Artist'
			}
		},
		{
			id: 'second',
			title: 'Second Track',
			artists: [{ id: 'artist', name: 'An Artist' }],
			duration: 210,
			reason: { code: 'profile_match' }
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
		await expect
			.element(page.getByText(m.generate_confidence_high(), { exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByText(m.generate_duration_approximate({ duration: '7m' }), { exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByText(m.generate_duration_estimated_detail({ known: 1, unknown: 1 })))
			.toBeInTheDocument();

		await page.getByRole('button', { name: m.player_play_all() }).click();
		await page.getByRole('button', { name: `${m.player_play_track()}: First Track` }).click();
		await page.getByRole('button', { name: m.playlist_save() }).click();
		await page.getByRole('button', { name: m.action_export_m3u8() }).click();

		expect(onPlay).toHaveBeenCalledOnce();
		expect(onPlayTrack).toHaveBeenCalledWith(set.tracks[0]);
		expect(onSave).toHaveBeenCalledOnce();
		expect(onExport).toHaveBeenCalledOnce();
	}, 30_000);

	it('renders an honest cold-start state instead of zero-duration playlist controls', async () => {
		const emptySet: ProvisionalSet = {
			...set,
			tracks: [],
			trackCount: 0,
			knownDurationSeconds: 0,
			unknownDurationCount: 0,
			estimatedDurationSeconds: 0,
			confidenceLabel: 'none'
		};

		render(GeneratedSet, {
			set: emptySet,
			onPlay: vi.fn(),
			onPlayTrack: vi.fn(),
			onSave: vi.fn(),
			onExport: vi.fn()
		});

		await expect.element(page.getByText(m.taste_set_cold_start())).toBeInTheDocument();
		await expect
			.element(page.getByRole('group', { name: m.generate_set_actions() }))
			.not.toBeInTheDocument();
	});
});
