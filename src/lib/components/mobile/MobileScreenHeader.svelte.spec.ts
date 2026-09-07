import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileScreenHeader from './MobileScreenHeader.svelte';

describe('MobileScreenHeader.svelte', () => {
	it('renders the heading as the level-1 focus target', async () => {
		render(MobileScreenHeader, { heading: 'Library', headingId: 'mobile-library-title' });

		const heading = page.getByRole('heading', { level: 1, name: 'Library' });
		await expect.element(heading).toBeInTheDocument();
		expect(heading.element().id).toBe('mobile-library-title');
	});

	it('omits the kicker and lead when not provided', async () => {
		const { container } = render(MobileScreenHeader, { heading: 'Search' });

		expect(container.querySelector('.kicker')).toBeNull();
		expect(container.querySelector('.lead')).toBeNull();
	});

	it('shows the kicker and lead when provided', async () => {
		render(MobileScreenHeader, {
			heading: 'Library',
			kicker: 'Halflight',
			lead: 'Return to something you love.'
		});

		await expect.element(page.getByText('Halflight')).toBeInTheDocument();
		await expect.element(page.getByText('Return to something you love.')).toBeInTheDocument();
	});
});
