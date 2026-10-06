<script lang="ts">
	import { onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import Button from '#lib/components/ui/Button.svelte';
	let { configured, hasPlayback = false }: { configured: boolean; hasPlayback?: boolean } =
		$props();
	interface DevicePrompt {
		deviceCode: string;
		userCode: string;
		verificationUriComplete: string;
		expiresIn: number;
		interval: number;
	}
	let prompt = $state<DevicePrompt | null>(null);
	let authState = $state<'idle' | 'pending' | 'waiting' | 'success' | 'error'>('idle');
	let timer: ReturnType<typeof setTimeout> | null = null;
	let request: AbortController | null = null;
	let expiryTimer: ReturnType<typeof setTimeout> | null = null;
	let expiresAt = 0;
	const verificationUrl = $derived.by(() => {
		if (!prompt) return null;
		try {
			const url = new URL(
				prompt.verificationUriComplete.startsWith('https://')
					? prompt.verificationUriComplete
					: 'https://' + prompt.verificationUriComplete
			);
			return url.protocol === 'https:' &&
				(url.hostname === 'tidal.com' || url.hostname.endsWith('.tidal.com'))
				? url.href
				: null;
		} catch {
			return null;
		}
	});
	function stop() {
		if (timer) clearTimeout(timer);
		if (expiryTimer) clearTimeout(expiryTimer);
		expiryTimer = null;
		timer = null;
		request?.abort();
	}
	onDestroy(stop);
	async function start() {
		if (authState === 'pending' || authState === 'waiting') return;
		stop();
		const controller = new AbortController();
		request = controller;
		authState = 'pending';
		expiryTimer = setTimeout(() => {
			controller.abort();
			authState = 'error';
		}, 30000);
		prompt = null;
		try {
			const response = await fetch('/api/tidal/device-auth', {
				method: 'POST',
				signal: controller.signal
			});
			if (!response.ok) throw new Error('authorization_failed');
			const data = (await response.json()) as DevicePrompt;
			if (
				!data.deviceCode ||
				!data.userCode ||
				!Number.isFinite(data.expiresIn) ||
				data.expiresIn <= 0
			)
				throw new Error('invalid_prompt');
			if (controller.signal.aborted) return;
			prompt = data;
			expiresAt = Date.now() + data.expiresIn * 1000;
			if (expiryTimer) clearTimeout(expiryTimer);
			expiryTimer = setTimeout(() => {
				controller.abort();
				prompt = null;
				authState = 'error';
			}, data.expiresIn * 1000);
			authState = 'waiting';
			schedule();
		} catch {
			if (!controller.signal.aborted) authState = 'error';
		}
	}
	function schedule() {
		const interval = Math.max(
			2000,
			(Number.isFinite(prompt?.interval) ? prompt!.interval : 2) * 1000
		);
		timer = setTimeout(() => void poll(), Math.min(interval, Math.max(0, expiresAt - Date.now())));
	}
	async function poll() {
		if (!prompt || !request || request.signal.aborted) return;
		if (Date.now() >= expiresAt) {
			authState = 'error';
			return;
		}
		const controller = request;
		try {
			const response = await fetch('/api/tidal/device-auth/poll', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ deviceCode: prompt.deviceCode }),
				signal: controller.signal
			});
			if (!response.ok) throw new Error('authorization_failed');
			const result = (await response.json()) as { status: string };
			if (controller.signal.aborted) return;
			if (result.status === 'success') {
				if (expiryTimer) clearTimeout(expiryTimer);
				expiryTimer = null;
				authState = 'success';
				prompt = null;
				await invalidateAll();
			} else if (result.status === 'pending' || result.status === 'slow_down') {
				if (result.status === 'slow_down' && prompt)
					prompt.interval = Math.max(prompt.interval || 2, 2) + 5;
				schedule();
			} else {
				authState = 'error';
				prompt = null;
			}
		} catch {
			if (!controller.signal.aborted) {
				authState = 'error';
				prompt = null;
			}
		}
	}
</script>

<section class="playback-setup" aria-labelledby="playback-setup-title">
	<h2 id="playback-setup-title">{m.tidal_device_auth_title()}</h2>
	<p>{m.tidal_device_auth_desc()}</p>
	<p role="status">
		{hasPlayback || authState === 'success'
			? m.tidal_playback_full_active()
			: m.tidal_playback_standard_only()}
	</p>
	{#if authState === 'waiting' && prompt}
		<p>{m.tidal_device_auth_prompt()}</p>
		<strong class="code">{prompt.userCode}</strong>
		{#if verificationUrl}<Button
				variant="primary"
				href={verificationUrl}
				target="_blank"
				rel="noreferrer">{m.tidal_device_auth_open()}</Button
			>{/if}
		<p role="status">{m.tidal_device_auth_waiting()}</p>
		<Button
			onclick={() => {
				stop();
				prompt = null;
				authState = 'idle';
			}}>{m.playlist_cancel()}</Button
		>
	{:else if authState === 'success'}
		<p role="status">{m.tidal_device_auth_success()}</p>
	{:else}
		<Button
			variant="primary"
			disabled={!configured || authState === 'pending'}
			onclick={() => void start()}>{m.tidal_device_auth_btn()}</Button
		>
		{#if authState === 'error'}<p role="alert">{m.tidal_device_auth_error()}</p>{/if}
	{/if}
</section>

<style>
	.playback-setup {
		display: grid;
		justify-items: start;
		gap: 0.75rem;
		margin-block: 1rem;
		padding: 1.25rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
	}
	h2,
	p {
		margin: 0;
	}
	p {
		color: var(--text-muted);
		line-height: 1.5;
	}
	.code {
		padding: 0.75rem;
		font-size: 1.5rem;
		letter-spacing: 0.15em;
	}
	p[role='alert'] {
		color: var(--danger);
	}
	.playback-setup :global(.btn-base) {
		min-height: 48px;
	}
</style>
