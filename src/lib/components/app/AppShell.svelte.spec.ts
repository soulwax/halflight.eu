import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import AppShell from './AppShell.svelte';
import '../../../routes/layout.css';

describe('AppShell', () => {
	it('scrolls long content above the desktop player without scrolling the document', async () => {
		const snippet = (markup: string) => createRawSnippet(() => ({ render: () => markup }));
		const { container, unmount } = render(AppShell, {
			navigation: [],
			currentPath: '/app',
			skipLinkLabel: 'Skip to main content',
			navigationLabel: 'Primary navigation',
			children: snippet(
				'<div style="height:3000px;display:flex;align-items:flex-end"><p>Last library track</p></div>'
			),
			player: snippet('<div style="height:96px">Desktop player</div>')
		});
		await expect.element(page.getByText('Desktop player')).toBeInTheDocument();
		const main = page.getByRole('main').element();
		const dock = container.querySelector<HTMLElement>('.app-shell-player')!;
		expect(main.scrollHeight).toBeGreaterThan(main.clientHeight);
		main.scrollTop = main.scrollHeight;
		window.scrollTo(0, 10_000);
		expect(document.scrollingElement?.scrollTop).toBe(0);
		expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1);
		expect(dock.getBoundingClientRect().bottom).toBeCloseTo(window.innerHeight, 0);
		expect(main.getBoundingClientRect().bottom).toBeCloseTo(dock.getBoundingClientRect().top, 0);
		expect(
			page.getByText('Last library track').element().getBoundingClientRect().bottom
		).toBeLessThanOrEqual(main.getBoundingClientRect().bottom);
		expect(getComputedStyle(document.documentElement).overflowY).toBe('hidden');
		await unmount();
		expect(getComputedStyle(document.documentElement).overflowY).not.toBe('hidden');
	});

	it('provides a skip link, labelled navigation, and the current page', async () => {
		render(AppShell, {
			navigation: [
				{ href: '/app', label: 'Home' },
				{ href: '/app/search', label: 'Search' }
			],
			currentPath: '/app/search',
			skipLinkLabel: 'Skip to main content',
			navigationLabel: 'Primary navigation',
			children: createRawSnippet(() => ({ render: () => '<h1>Search</h1>' }))
		});

		await expect
			.element(page.getByRole('link', { name: 'Skip to main content' }))
			.toHaveAttribute('href', '#main-content');
		await expect.element(page.getByRole('main')).toHaveAttribute('id', 'main-content');
		await expect
			.element(
				page
					.getByRole('navigation', { name: 'Primary navigation' })
					.getByRole('link', { name: 'Search' })
					.first()
			)
			.toHaveAttribute('aria-current', 'page');
	});

	it('renders named shell regions only when a route supplies them', async () => {
		const snippet = (markup: string) => createRawSnippet(() => ({ render: () => markup }));

		render(AppShell, {
			navigation: [],
			currentPath: '/app',
			skipLinkLabel: 'Skip to main content',
			navigationLabel: 'Primary navigation',
			header: snippet('<p>Room header</p>'),
			aside: snippet('<p>Up next</p>'),
			asideLabel: 'Listening context',
			asideOpen: true,
			player: snippet('<p>Room player</p>'),
			footer: snippet('<p>Room footer</p>'),
			children: snippet('<h1>Home</h1>')
		});

		await expect.element(page.getByText('Room header')).toBeInTheDocument();
		// The context region only becomes visible at the wide-shell breakpoint;
		// the component contract here is that a supplied region is rendered.
		await expect.element(page.getByText('Up next')).toBeInTheDocument();
		await expect.element(page.getByText('Room player')).toBeInTheDocument();
		await expect.element(page.getByText('Room footer')).toBeInTheDocument();

		const footerRegion = page.getByText('Room footer').element().parentElement;
		expect(footerRegion?.classList.contains('app-shell-footer')).toBe(true);
		expect(footerRegion?.querySelector('.mobile-listening-room-nav')).toBeNull();
	});

	it('does not consume the context column until its aside is explicitly opened', async () => {
		const snippet = (markup: string) => createRawSnippet(() => ({ render: () => markup }));

		render(AppShell, {
			navigation: [],
			currentPath: '/app',
			skipLinkLabel: 'Skip to main content',
			navigationLabel: 'Primary navigation',
			aside: snippet('<p>Closed queue</p>'),
			asideLabel: 'Queue',
			asideOpen: false,
			children: snippet('<h1>Home</h1>')
		});

		await expect.element(page.getByText('Closed queue')).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('complementary', { name: 'Queue' }))
			.not.toBeInTheDocument();
	});
});
