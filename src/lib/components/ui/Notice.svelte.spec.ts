import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Notice from './Notice.svelte';
import { createRawSnippet } from 'svelte';

const message = (text: string) =>
	createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Notice.svelte', () => {
	it('interrupts for a failure and waits its turn for anything else', async () => {
		// Every call site used to pick the role by hand, and they did not agree:
		// two identical "reconnect required" warnings shipped as `alert` on one
		// route and `status` on another.
		render(Notice, { tone: 'danger', children: message('Could not save') });
		await expect.element(page.getByRole('alert')).toHaveTextContent('Could not save');
	});

	it.each(['info', 'success', 'warning'] as const)('announces %s politely', async (tone) => {
		render(Notice, { tone, children: message('Connected') });
		await expect.element(page.getByRole('status')).toHaveTextContent('Connected');
	});

	it('defaults to the neutral tone', async () => {
		render(Notice, { children: message('Disconnected') });
		await expect.element(page.getByRole('status')).toHaveAttribute('data-tone', 'info');
	});

	it('carries an icon so tone is never conveyed by colour alone', async () => {
		// Two of the routes this replaced separated success from failure with text
		// colour and nothing else.
		for (const tone of ['info', 'success', 'warning', 'danger'] as const) {
			const { container } = render(Notice, { tone, children: message('x') });
			expect(container.querySelector('svg')).not.toBeNull();
		}
	});
});
