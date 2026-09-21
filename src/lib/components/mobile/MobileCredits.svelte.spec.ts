import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileCredits from './MobileCredits.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';

afterEach(() => {
	player.currentTrack = null;
});

beforeEach(() => {
	player.currentTrack = null;
});

describe('MobileCredits.svelte', () => {
	it('keeps a safe return to Now Playing when no work is selected', async () => {
		render(MobileCredits);
		await expect.element(page.getByText(m.now_credits_empty())).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: m.now_credits_back() }))
			.toHaveAttribute('href', '/now');
	});
});
