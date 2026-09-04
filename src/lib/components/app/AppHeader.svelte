<script lang="ts">
	import { LogIn, LogOut, Settings, Shield } from '@lucide/svelte';
	import ThemeSelector from '#lib/components/ui/ThemeSelector.svelte';
	import synLogo from '#lib/assets/syn-logo.svg';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		user?: {
			name?: string;
			email?: string;
			isAdministrator?: boolean;
			isFirstAdministrator?: boolean;
		} | null;
	}

	let { user = null }: Props = $props();
</script>

<header
	class="app-header sticky top-0 z-40 flex h-14 w-full shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]/95 px-4 backdrop-blur-md sm:px-6"
>
	<!-- Leftmost: Logo -->
	<div class="flex items-center">
		<a
			href={user ? '/app' : '/'}
			class="flex items-center transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--action)]"
			aria-label={m.brand_name()}
		>
			<img src={synLogo} alt={m.brand_name()} class="h-7 w-auto sm:h-8" />
		</a>
	</div>

	<!-- Right: Style Chooser Dropdown, Admin Button, Settings Icon, and Login/Logout Button -->
	<div class="flex items-center gap-2.5 sm:gap-4">
		<div class="xs:w-44 w-36 sm:w-52">
			<ThemeSelector compact={true} id="header-theme-selector" />
		</div>

		{#if user?.isAdministrator}
			<a
				href="/app/admin"
				class="app-header-admin-btn inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-secondary)] transition-colors hover:border-[var(--action)] hover:bg-[color-mix(in_oklab,var(--action)_12%,transparent)] hover:text-[var(--action)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--action)] sm:h-9 sm:w-9"
				title={m.nav_admin()}
				aria-label={m.nav_admin()}
			>
				<Shield size={16} class="sm:hidden" />
				<Shield size={18} class="hidden sm:block" />
			</a>
		{/if}

		<a
			href="/app/settings/tidal"
			class="app-header-settings-btn inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-secondary)] transition-colors hover:border-[var(--action)] hover:bg-[color-mix(in_oklab,var(--action)_12%,transparent)] hover:text-[var(--action)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--action)] sm:h-9 sm:w-9"
			title={m.nav_settings()}
			aria-label={m.nav_settings()}
		>
			<Settings size={16} class="sm:hidden" />
			<Settings size={18} class="hidden sm:block" />
		</a>

		{#if user}
			<form method="POST" action="/logout" class="flex items-center">
				<button
					type="submit"
					class="app-header-auth-btn inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-secondary)] transition-colors hover:border-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] hover:text-[var(--danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--action)] sm:h-9 sm:w-9"
					title={m.sign_out()}
					aria-label={m.sign_out()}
				>
					<LogOut size={16} class="sm:hidden" />
					<LogOut size={18} class="hidden sm:block" />
				</button>
			</form>
		{:else}
			<a
				href="/sign-in"
				class="app-header-auth-btn inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-secondary)] transition-colors hover:border-[var(--action)] hover:bg-[color-mix(in_oklab,var(--action)_12%,transparent)] hover:text-[var(--action)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--action)] sm:h-9 sm:w-9"
				title={m.sign_in_button()}
				aria-label={m.sign_in_button()}
			>
				<LogIn size={16} class="sm:hidden" />
				<LogIn size={18} class="hidden sm:block" />
			</a>
		{/if}
	</div>
</header>
