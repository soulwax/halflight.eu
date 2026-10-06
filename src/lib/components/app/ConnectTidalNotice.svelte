<script lang="ts">
	import Notice from '#lib/components/ui/Notice.svelte';
	import { m } from '#lib/paraglide/messages.js';

	/**
	 * Standing onboarding prompt for a listener whose own TIDAL account is not
	 * fully linked yet. Each listener brings their own account, so a fresh sign-up
	 * lands here before anything can play. Renders nothing once browse and playback
	 * are both connected, or when the server has no TIDAL app configured.
	 */
	let {
		connection,
		settingsHref,
		hidden = false
	}: {
		connection: { connected: boolean; configured: boolean; hasPlayback?: boolean };
		settingsHref: string;
		hidden?: boolean;
	} = $props();

	const needsBrowse = $derived(!connection.connected);
	const needsPlayback = $derived(connection.connected && connection.hasPlayback === false);
</script>

{#if !hidden && connection.configured && (needsBrowse || needsPlayback)}
	<Notice tone="info">
		<p>{needsBrowse ? m.onboarding_connect_browse() : m.onboarding_connect_playback()}</p>
		<a class="underline" href={settingsHref}>{m.onboarding_connect_action()}</a>
	</Notice>
{/if}
