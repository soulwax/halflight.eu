import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Badge from './Badge.svelte';

describe('Badge.svelte', () => {
	it('defaults an explicit badge to "E" with an "Explicit" title', async () => {
		render(Badge, { variant: 'explicit' });
		const el = page.getByTitle('Explicit');
		await expect.element(el).toHaveTextContent('E');
	});

	it('humanises the quality text (underscores to spaces)', async () => {
		render(Badge, { variant: 'quality', text: 'HI_RES_LOSSLESS' });
		await expect.element(page.getByText('HI RES LOSSLESS')).toBeInTheDocument();
	});

	it('tags a quality badge with its fidelity tier for colouring', async () => {
		render(Badge, { variant: 'quality', text: 'HI_RES_LOSSLESS' });
		await expect.element(page.getByText('HI RES LOSSLESS')).toHaveAttribute('data-tier', 'hires');
	});

	it('passes a custom title through', async () => {
		render(Badge, { variant: 'accent', text: 'NEW', title: 'Fresh release' });
		await expect.element(page.getByTitle('Fresh release')).toHaveTextContent('NEW');
	});

	it('renders a tag as its own neutral variant, not as an unrecognised quality', async () => {
		// The taste settings page's confidence badge picks between 'accent' (high
		// confidence) and 'tag' (every other level). 'tag' used to fall through to
		// the 'quality' branch by accident, running `qualityTier()` on a whole
		// sentence — harmless today only because that function's fallback happens
		// to be the same muted colour. Pin the tag as its own explicit case so a
		// future change to quality-tier styling can't silently break it.
		render(Badge, { variant: 'tag', text: 'Initial confidence' });
		const el = page.getByText('Initial confidence');
		await expect.element(el).toBeInTheDocument();
		await expect.element(el).toHaveAttribute('data-tier', 'lossy');
	});
});
