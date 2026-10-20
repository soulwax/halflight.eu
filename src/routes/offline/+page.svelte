<script lang="ts">
	import OfflineRecovery from '#lib/components/mobile/OfflineRecovery.svelte';
	import { getLocale } from '#lib/paraglide/runtime';

	const locale = getLocale();
</script>

<OfflineRecovery {locale} />
