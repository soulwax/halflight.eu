<script lang="ts">
	import MobileHomeResume from '#lib/components/mobile/MobileHomeResume.svelte';
	import MobileMixRail from '#lib/components/mobile/MobileMixRail.svelte';
	import MobileGenerateInvitation from '#lib/components/mobile/MobileGenerateInvitation.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<MobileHomeResume />

<div class="home-generate">
	<MobileGenerateInvitation />
</div>

{#if data.dailyMix.length > 0}
	<div class="home-mix">
		<MobileMixRail tracks={data.dailyMix} />
	</div>
{/if}

<style>
	.home-mix {
		margin-top: calc(-1 * clamp(1.5rem, 8vw, 3rem));
		padding: 0 0 clamp(3rem, 10vw, 4.5rem) clamp(1.25rem, 5vw, 2rem);
	}

	.home-generate {
		padding: 0 clamp(1.25rem, 5vw, 2rem);
	}
</style>
