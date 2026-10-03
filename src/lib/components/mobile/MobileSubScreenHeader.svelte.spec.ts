import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { SvelteMap } from 'svelte/reactivity';
import { MOBILE_DETAIL_NAVIGATION } from '#lib/mobile/navigation';
import MobileSubScreenHeader from './MobileSubScreenHeader.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('https://m.halflight.test/albums/42') } }));

describe('MobileSubScreenHeader.svelte', () => {
	it('returns a detail to its browse context while leaving explicit Now links intact', async () => {
		const targets = new SvelteMap([['/albums/42', '/search?q=ambient&tab=albums']]);
		const { rerender } = render(MobileSubScreenHeader, {
			props: { backHref: '/home', backLabel: 'Back', heading: 'Album', contextualBack: true },
			context: new Map([[MOBILE_DETAIL_NAVIGATION, { returnTargets: targets }]])
		});
		await expect
			.element(page.getByRole('link', { name: 'Back', exact: true }))
			.toHaveAttribute('href', '/search?q=ambient&tab=albums');
		targets.set('/albums/42', '/library?tab=saved&page=2');
		await expect
			.element(page.getByRole('link', { name: 'Back', exact: true }))
			.toHaveAttribute('href', '/library?tab=saved&page=2');
		await rerender({ contextualBack: false, backHref: '/now' });
		await expect
			.element(page.getByRole('link', { name: 'Back', exact: true }))
			.toHaveAttribute('href', '/now');
	});

	it('renders the heading and a labelled back link', async () => {
		render(MobileSubScreenHeader, {
			backHref: '/now',
			backLabel: 'Back to Now Playing',
			heading: 'Queue',
			headingId: 'queue-title'
		});

		const heading = page.getByRole('heading', { level: 1, name: 'Queue' });
		await expect.element(heading).toBeInTheDocument();
		expect(heading.element().id).toBe('queue-title');

		const back = page.getByRole('link', { name: 'Back to Now Playing' });
		await expect.element(back).toBeInTheDocument();
		expect(back.element().getAttribute('href')).toBe('/now');
	});

	it('shows the subtitle only when provided', async () => {
		const { container, rerender } = render(MobileSubScreenHeader, {
			backHref: '/now',
			backLabel: 'Back',
			heading: 'Lyrics'
		});
		expect(container.querySelector('.copy p')).toBeNull();

		await rerender({
			backHref: '/now',
			backLabel: 'Back',
			heading: 'Lyrics',
			subtitle: 'Bela Lugosi Is Dead'
		});
		await expect.element(page.getByText('Bela Lugosi Is Dead')).toBeInTheDocument();
	});

	it('renders a wrapping lead line, and prefers the subtitle when both are set', async () => {
		const { container, rerender } = render(MobileSubScreenHeader, {
			backHref: '/home',
			backLabel: 'Back',
			heading: 'Settings',
			lead: 'Tune quality, volume, and your TIDAL connection.'
		});
		await expect
			.element(page.getByText('Tune quality, volume, and your TIDAL connection.'))
			.toBeInTheDocument();
		expect(container.querySelector('.lead')).not.toBeNull();

		await rerender({
			backHref: '/home',
			backLabel: 'Back',
			heading: 'Settings',
			subtitle: 'Short line',
			lead: 'This lead is suppressed.'
		});
		await expect.element(page.getByText('Short line')).toBeInTheDocument();
		expect(container.querySelector('.lead')).toBeNull();
	});
});
