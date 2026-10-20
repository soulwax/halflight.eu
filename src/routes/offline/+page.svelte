<script lang="ts">
	import OfflineRecovery from '#lib/components/OfflineRecovery.svelte';
	import { getLocale } from '#lib/paraglide/runtime';

	const locale = getLocale();
</script>

<OfflineRecovery {locale} />
