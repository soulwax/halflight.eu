import { page } from 'vitest/browser';
import { afterEach, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NowPlayingScreen from './NowPlayingScreen.svelte';
import NowTabBar from './NowTabBar.svelte';
import { player } from '#lib/player/player.svelte';
import { m } from '#lib/paraglide/messages';
import { setLocale } from '#lib/paraglide/runtime';
import '../../../routes/layout.css';

afterEach(async () => {
	document.documentElement.style.fontSize = '';
	await setLocale('en', { reload: false });
	player.currentTrack = null;
	player.isLoading = false;
	player.activeDevice = null;
	await page.viewport(1280, 900);
});
it.each([
	{ width: 320, height: 640, locale: 'en' as const, scale: 1 },
	{ width: 390, height: 844, locale: 'en' as const, scale: 1 },
	{ width: 320, height: 640, locale: 'de-de' as const, scale: 2 },
	{ width: 640, height: 360, locale: 'de-de' as const, scale: 1 }
])(
	'keeps transport reachable at $width×$height, $locale, text $scale',
	async ({ width, height, locale, scale }) => {
		await page.viewport(width, height);
		await setLocale(locale, { reload: false });
		document.documentElement.style.fontSize = 16 * scale + 'px';
		player.currentTrack = {
			kind: 'track',
			id: '9',
			title: 'Bela Lugosi Is Dead — Live at the listening room',
			artists: [{ id: 'bauhaus', name: 'Bauhaus' }],
			imageUrl:
				'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="slateblue"/%3E%3C/svg%3E'
		};
		player.playbackMode = 'direct';
		player.repeatMode = 'off';
		player.isPlaying = false;
		player.isLoading = false;
		player.duration = 542;
		player.currentTime = 84;
		player.persistenceStatus = 'saved';
		await render(NowPlayingScreen);
		await expect
			.element(page.getByRole('button', { name: m.player_play_track() }))
			.toBeInTheDocument();
		for (const name of [
			m.player_shuffle(),
			m.player_previous(),
			m.player_play_track(),
			m.player_next(),
			m.player_repeat_off()
		]) {
			const rect = page.getByRole('button', { name }).element().getBoundingClientRect();
			expect(rect.width).toBeGreaterThanOrEqual(48);
			expect(rect.height).toBeGreaterThanOrEqual(48);
			expect(rect.left).toBeGreaterThanOrEqual(0);
			expect(rect.right).toBeLessThanOrEqual(width);
		}
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
	}
);
it('keeps all four German navigation labels and touch targets at 320px with enlarged text', async () => {
	await page.viewport(320, 640);
	await setLocale('de-de', { reload: false });
	document.documentElement.style.fontSize = '32px';
	await render(NowTabBar, { currentPath: '/library' });
	for (const name of [m.now_tab_home(), m.now_tab_search(), m.now_tab_library(), m.now_tab_now()]) {
		const tab = page.getByRole('link', { name });
		await expect.element(tab).toBeInTheDocument();
		const rect = tab.element().getBoundingClientRect();
		expect(rect.height).toBeGreaterThanOrEqual(48);
		expect(rect.right).toBeLessThanOrEqual(320);
	}
	await expect
		.element(page.getByRole('link', { name: m.now_tab_library() }))
		.toHaveAttribute('aria-current', 'page');
});
