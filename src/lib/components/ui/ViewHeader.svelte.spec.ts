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
});
