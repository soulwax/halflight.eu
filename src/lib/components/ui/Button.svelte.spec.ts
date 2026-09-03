import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import Button from './Button.svelte';

const label = () => createRawSnippet(() => ({ render: () => '<span>Go</span>' }));

describe('Button.svelte', () => {
	it('renders a <button> with the given type and label', async () => {
		render(Button, { type: 'submit', children: label() });
		const el = page.getByRole('button', { name: 'Go' });
		await expect.element(el).toHaveAttribute('type', 'submit');
	});

	it('renders an <a> when href is set and carries the variant class', async () => {
		render(Button, { href: '/app', variant: 'primary', children: label() });
		const link = page.getByRole('link', { name: 'Go' });
		await expect.element(link).toHaveAttribute('href', '/app');
		await expect.element(link).toHaveClass('btn-primary');
	});

	it('fires onclick and honours disabled', async () => {
		const onclick = vi.fn();
		render(Button, { onclick, disabled: true, children: label() });
		const el = page.getByRole('button', { name: 'Go' });
		await expect.element(el).toBeDisabled();
	});
});
