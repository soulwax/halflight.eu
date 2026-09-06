import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileHomeResume from './MobileHomeResume.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';

const track: TrackSummary = {
	kind: 'track',
	id: '9',
	title: 'Bela Lugosi Is Dead',
	artists: [{ id: 'a1', name: 'Bauhaus' }],
	album: { id: 'al1', title: 'Press the Eject' }
};

afterEach(() => {
	player.currentTrack = null;
});

describe('MobileHomeResume.svelte', () => {
	it('shows an honest empty state when nothing has played', async () => {
		player.currentTrack = null;
		render(MobileHomeResume);

		await expect
			.element(page.getByRole('heading', { name: m.now_home_heading() }))
			.toBeInTheDocument();
		await expect.element(page.getByText(m.now_home_empty())).toBeInTheDocument();
		await expect.element(page.getByRole('link')).not.toBeInTheDocument();
	});

	it('offers to resume the current track', async () => {
		player.currentTrack = track;
		render(MobileHomeResume);

		await expect.element(page.getByText('Bela Lugosi Is Dead')).toBeInTheDocument();
		await expect.element(page.getByText('Bauhaus')).toBeInTheDocument();
		const resume = page.getByRole('link', { name: m.now_home_resume_cta() });
		await expect.element(resume).toBeInTheDocument();
		expect(resume.element().getAttribute('href')).toBe('/now');
	});
});
