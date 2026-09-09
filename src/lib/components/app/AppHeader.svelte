<script lang="ts">
	import { LogIn, LogOut, Settings, Shield } from '@lucide/svelte';
	import HeaderSearch from '#lib/components/app/HeaderSearch.svelte';
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
	class="app-header flex h-full min-h-14 w-full shrink-0 items-center gap-4 border-b border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--surface-raised)_94%,transparent)] px-4 backdrop-blur-md sm:min-h-16 sm:px-7"
>
	<!-- Leftmost: Logo -->
	<div class="flex items-center">
		<a
			href={user ? '/app' : '/'}
			class="brand-mark flex items-center transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]"
			aria-label={m.brand_name()}
		>
			<img
				src="/icons/emily-the-strange-music-with-many-paths-64.png"
				alt={m.brand_name()}
				class="h-7 w-7 sm:h-8 sm:w-8"
			/>
		</a>
	</div>

	{#if user}
		<div class="min-w-0 flex-1">
			<HeaderSearch />
		</div>
	{:else}
		<div class="flex-1"></div>
	{/if}

	<!-- Right: Style Chooser Dropdown, Admin Button, Settings Icon, and Login/Logout Button -->
	<div class="header-actions flex shrink-0 items-center gap-2 sm:gap-2.5">
		{#if user?.isAdministrator}
			<a
				href="/app/admin"
				class="app-header-admin-btn inline-flex h-8 w-8 items-center justify-center rounded-[0.625rem] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-[border-color,background-color,color,transform] hover:-translate-y-px hover:border-[color-mix(in_oklab,var(--action)_58%,var(--border-subtle))] hover:bg-[var(--surface-selected)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] sm:h-9 sm:w-9"
				title={m.nav_admin()}
				aria-label={m.nav_admin()}
			>
				<Shield size={16} class="sm:hidden" />
				<Shield size={18} class="hidden sm:block" />
			</a>
		{/if}

		<a
			href="/app/settings/tidal"
			class="app-header-settings-btn inline-flex h-8 w-8 items-center justify-center rounded-[0.625rem] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-[border-color,background-color,color,transform] hover:-translate-y-px hover:border-[color-mix(in_oklab,var(--action)_58%,var(--border-subtle))] hover:bg-[var(--surface-selected)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] sm:h-9 sm:w-9"
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
					class="app-header-auth-btn inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[0.625rem] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-[border-color,background-color,color,transform] hover:-translate-y-px hover:border-[color-mix(in_oklab,var(--danger)_58%,var(--border-subtle))] hover:bg-[var(--danger-subtle)] hover:text-[var(--danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] sm:h-9 sm:w-9"
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
				class="app-header-auth-btn inline-flex h-8 w-8 items-center justify-center rounded-[0.625rem] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-[border-color,background-color,color,transform] hover:-translate-y-px hover:border-[color-mix(in_oklab,var(--action)_58%,var(--border-subtle))] hover:bg-[var(--surface-selected)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] sm:h-9 sm:w-9"
				title={m.sign_in_button()}
				aria-label={m.sign_in_button()}
			>
				<LogIn size={16} class="sm:hidden" />
				<LogIn size={18} class="hidden sm:block" />
			</a>
		{/if}
	</div>
</header>
