<script lang="ts">
	import { APP_VERSION } from '#lib/version';
	import { m } from '#lib/paraglide/messages.js';

	const footerNotice = $derived(
		m.footer_text?.({ version: APP_VERSION }) ??
			`${APP_VERSION} - Copyright Bluesix Team 2026 All Rights Reserved - Tidal Reserves Their Own Rights, So Does Github under their country's jurisdictions`
	);
</script>

<footer
	class="app-footer flex h-[10px] w-full shrink-0 items-center justify-center overflow-hidden bg-(--surface-canvas) px-2 text-center text-[8px] leading-[10px] text-[color-mix(in_oklab,var(--text-muted)_55%,transparent)] select-none"
	title={footerNotice}
>
	<p class="m-0 truncate leading-[10px]">
		{footerNotice}
	</p>
</footer>
