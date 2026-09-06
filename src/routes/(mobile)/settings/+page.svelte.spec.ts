import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SettingsPage from './+page.svelte';
import { m } from '#lib/paraglide/messages.js';
import type { PageData } from './$types';

type DeferredPromptEvent = Event & {
	prompt: ReturnType<typeof vi.fn>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function installPrompt(
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
): DeferredPromptEvent {
	const event = new Event('beforeinstallprompt', { cancelable: true }) as DeferredPromptEvent;
	event.prompt = vi.fn().mockResolvedValue(undefined);
	event.userChoice = userChoice;
	return event;
}

const data = {
	connection: { configured: true, connected: true },
	streamingSettings: { preferredQuality: 'HIGH', volume: 75, loudnessNormalization: true }
} as PageData;

describe('mobile settings install flow', () => {
	it('offers browser-specific installation help until the browser makes an install prompt available', async () => {
		render(SettingsPage, { data, form: undefined });

		await expect
			.element(page.getByText(m.mobile_install_help_title(), { exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.mobile_install_action() }))
			.not.toBeInTheDocument();
	});

	it('waits for appinstalled before reporting an accepted browser prompt as installed', async () => {
		let resolveChoice: (result: { outcome: 'accepted' | 'dismissed' }) => void;
		const choice = new Promise<{ outcome: 'accepted' | 'dismissed' }>((resolve) => {
			resolveChoice = resolve;
		});
		const prompt = installPrompt(choice);
		render(SettingsPage, { data, form: undefined });

		window.dispatchEvent(prompt);
		await expect
			.element(page.getByRole('button', { name: m.mobile_install_action() }))
			.toBeInTheDocument();
		expect(prompt.defaultPrevented).toBe(true);

		const action = page.getByRole('button', { name: m.mobile_install_action() });
		await action.click();
		expect(prompt.prompt).toHaveBeenCalledOnce();
		await expect.element(action).toBeDisabled();
		expect(action.element().getAttribute('aria-busy')).toBe('true');

		resolveChoice!({ outcome: 'accepted' });
		await expect.element(action).not.toBeDisabled();
		await expect
			.element(page.getByText(m.mobile_install_installed(), { exact: true }))
			.not.toBeInTheDocument();

		window.dispatchEvent(new Event('appinstalled'));
		await expect
			.element(page.getByText(m.mobile_install_installed(), { exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: m.mobile_install_action() }))
			.not.toBeInTheDocument();
	});
});
