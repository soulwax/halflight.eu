import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ViewHeader from './ViewHeader.svelte';

describe('ViewHeader.svelte', () => {
	it('renders the title as the view level-one heading', async () => {
		render(ViewHeader, { title: 'Search TIDAL' });
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Search TIDAL');
	});

	it('links the heading to the landmark that labels itself by it', async () => {
		// Every route passes `titleId` and points its own `aria-labelledby` at it;
		// dropping the attribute would silently unname the whole view.
		render(ViewHeader, { title: 'Library', titleId: 'library-title' });
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveAttribute('id', 'library-title');
	});

	it('omits the eyebrow and description when a view has none', async () => {
		render(ViewHeader, { title: 'Mixes' });
		const header = page.getByRole('heading', { level: 1 }).element().closest('header');
		expect(header?.querySelectorAll('p')).toHaveLength(0);
	});

	it('renders the eyebrow and description when given', async () => {
		render(ViewHeader, {
			title: 'Search TIDAL',
			eyebrow: 'Halflight // Exploration',
			description: 'Find tracks, albums, artists, and playlists.'
		});
		await expect.element(page.getByText('Halflight // Exploration')).toBeInTheDocument();
		await expect
			.element(page.getByText('Find tracks, albums, artists, and playlists.'))
			.toBeInTheDocument();
	});

	it('keeps the hero line at the one-per-view type step', async () => {
		// `layout.css` comments `--fs-2xl` as "the one hero line per view, no
		// bigger". Eight routes each had their own `<h1>` rule before this
		// component existed, and five exceeded that ceiling — one reached 56px.
		// Driving the size off the token (rather than asserting a pixel value the
		// stylesheet would have to supply) pins the rule without pinning the scale.
		document.documentElement.style.setProperty('--fs-2xl', '32px');
		try {
			render(ViewHeader, { title: 'Search TIDAL' });
			const heading = page.getByRole('heading', { level: 1 }).element();
			expect(getComputedStyle(heading).fontSize).toBe('32px');
		} finally {
			document.documentElement.style.removeProperty('--fs-2xl');
		}
	});

	it('never shadows the active theme’s heading identity (family, weight, tracking)', async () => {
		// This is the one heading every theme's "beyond colour" identity most
		// needs to reach — nine routes share it. layout.css's shared h1,h2,h3
		// rule sets font-family/weight/letter-spacing from --font-heading/
		// --heading-weight/--heading-tracking (Electric's monospace readout,
		// Light's editorial serif); this component must never shadow any of
		// them with its own hardcoded value, the way it once hardcoded
		// font-weight: 700 and letter-spacing: -0.01em. The component test
		// suite doesn't load layout.css (see the token test above, which
		// works around the same gap), so a rule with the same shape — an
		// author-level `h1` selector, which is what actually needs to beat
		// both the browser's own bold-by-default h1 and any local override —
		// stands in for it here.
		const themeRule = document.createElement('style');
		themeRule.textContent =
			'h1 { font-family: Georgia, serif; font-weight: 500; letter-spacing: 0.04em; }';
		document.head.appendChild(themeRule);

		try {
			render(ViewHeader, { title: 'Search TIDAL' });
			const style = getComputedStyle(page.getByRole('heading', { level: 1 }).element());
			expect(style.fontFamily).toContain('Georgia');
			expect(style.fontWeight).toBe('500');
			// The browser reports this resolved to px, not the authored em value —
			// 'normal' is what it would read if nothing (the themed rule
			// included) set it, which is the failure this test exists to catch.
			expect(style.letterSpacing).not.toBe('normal');
		} finally {
			themeRule.remove();
		}
	});
});
