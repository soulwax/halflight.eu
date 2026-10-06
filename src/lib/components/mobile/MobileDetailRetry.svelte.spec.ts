import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileDetailRetry from './MobileDetailRetry.svelte';
import { m } from '#lib/paraglide/messages.js';

const navigation = vi.hoisted(() => ({ invalidateAll: vi.fn() }));
vi.mock('$app/navigation', () => navigation);

beforeEach(() => {
	navigation.invalidateAll.mockReset();
});

describe('MobileDetailRetry.svelte', () => {
	it('disables repeated retries while refreshing and enables them when done', async () => {
		let finish!: () => void;
		navigation.invalidateAll.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				})
		);
		render(MobileDetailRetry);
		const retry = page.getByRole('button', { name: m.track_retry() });
		await retry.click();
		await expect.element(retry).toBeDisabled();
		await expect.element(retry).toHaveAttribute('aria-busy', 'true');
		expect(navigation.invalidateAll).toHaveBeenCalledOnce();
		finish();
		await expect.element(retry).toBeEnabled();
	});

	it('reports a failed refresh and permits a successful retry', async () => {
		navigation.invalidateAll
			.mockRejectedValueOnce(new Error('Offline'))
			.mockResolvedValueOnce(undefined);
		render(MobileDetailRetry);
		const retry = page.getByRole('button', { name: m.track_retry() });
		await retry.click();
		await expect.element(page.getByRole('status')).toHaveTextContent(m.now_detail_retry_failed());
		await expect.element(retry).toBeEnabled();
		await retry.click();
		await expect.element(page.getByText(m.now_detail_retry_failed())).not.toBeInTheDocument();
		expect(navigation.invalidateAll).toHaveBeenCalledTimes(2);
	});
});
