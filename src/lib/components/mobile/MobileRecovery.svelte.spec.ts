import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileRecovery from './MobileRecovery.svelte';
import { player } from '#lib/player/player.svelte.js';
import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models';
import '../../../routes/layout.css';

const track: TrackSummary = {
	kind: 'track',
	id: 'recovery-track',
	title: 'Recovery Track',
	duration: 200,
	artists: [{ id: 'recovery-artist', name: 'Recovery Artist' }]
};

beforeEach(() => {
	player.currentTrack = null;
	player.resumeStatus = 'ready';
	player.playbackMode = 'direct';
	player.playbackReason = null;
	player.requiresFullAuth = false;
	player.activeDevice = null;
	player.playbackClaimPending = false;
	player.isLoading = false;
	player.persistenceStatus = 'saved';
	player.localQueueSaved = true;
});

afterEach(() => vi.restoreAllMocks());

describe('MobileRecovery.svelte', () => {
	it('does not insert an empty recovery row during routine save transitions', async () => {
		player.persistenceStatus = 'offline';
		const { container } = render(MobileRecovery);
		await expect
			.element(page.getByRole('button', { name: m.player_sync_local() }))
			.toBeInTheDocument();
		player.persistenceStatus = 'saving';
		await expect.poll(() => container.querySelector('.mobile-recovery')).toBeNull();
		player.persistenceStatus = 'saved';
		await expect.poll(() => container.querySelector('.mobile-recovery')).toBeNull();
	});
	it('stays quiet when playback and queue state are healthy', async () => {
		const { container } = render(MobileRecovery);

		await expect.element(page.getByRole('status')).not.toBeInTheDocument();
		expect(container.querySelector('.mobile-recovery')).toBeNull();
	});

	it('keeps playback retry available after leaving Now Playing', async () => {
		player.currentTrack = track;
		player.resumeStatus = 'temporary';
		const retry = vi.spyOn(player, 'retryPlayback').mockImplementation(() => {});
		await render(MobileRecovery);

		await expect.element(page.getByText(m.player_temporary_failure())).toBeInTheDocument();
		await page.getByRole('button', { name: m.track_retry() }).click();
		expect(retry).toHaveBeenCalledOnce();
	});

	it('keeps queue save recovery visible without a current track', async () => {
		player.persistenceStatus = 'offline';
		const retry = vi.spyOn(player, 'retryPersistence').mockImplementation(() => {});
		await render(MobileRecovery);

		const status = page.getByRole('button', { name: m.player_sync_local() });
		await expect.element(status).toBeInTheDocument();
		await expect.element(status).toHaveTextContent(m.player_sync_local());
		await status.click();
		await page.getByRole('dialog').getByRole('button', { name: m.player_sync_retry() }).click();
		expect(retry).toHaveBeenCalledOnce();
	});

	it('keeps queue recovery local on the queue screen to avoid duplicate controls', async () => {
		player.persistenceStatus = 'conflict';
		const { container } = render(MobileRecovery, { includeQueueSync: false });

		expect(container.querySelector('.mobile-recovery')).toBeNull();
		await expect
			.element(page.getByRole('button', { name: m.player_sync_conflict() }))
			.not.toBeInTheDocument();
	});
});
