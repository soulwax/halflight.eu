<script lang="ts">
	import HeaderSearch from '#lib/components/app/HeaderSearch.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { LogIn, LogOut, Settings, Shield } from '@lucide/svelte';

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
	class="app-header flex h-full w-full shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--surface-raised)_94%,transparent)] px-(--shell-gutter) backdrop-blur-md sm:gap-4"
>
	<a href={user ? '/app' : '/'} class="header-brand" aria-label={m.brand_name()}>
		<img src="/icons/halflight-64.png" alt={m.brand_name()} />
	</a>

	<div class="header-search-slot">
		{#if user}
			<HeaderSearch />
		{/if}
	</div>

	<nav class="header-actions" aria-label={m.nav_primary()}>
		{#if user?.isAdministrator}
			<a class="header-btn" href="/app/admin" title={m.nav_admin()} aria-label={m.nav_admin()}>
				<Shield size={18} aria-hidden="true" />
			</a>
		{/if}

		<a
			class="header-btn"
			href="/app/settings/tidal"
			title={m.nav_settings()}
			aria-label={m.nav_settings()}
		>
			<Settings size={18} aria-hidden="true" />
		</a>

		{#if user}
			<form method="POST" action="/logout">
				<button
					type="submit"
					class="header-btn header-btn--danger"
					title={m.sign_out()}
					aria-label={m.sign_out()}
				>
					<LogOut size={18} aria-hidden="true" />
				</button>
			</form>
		{:else}
			<a
				class="header-btn"
				href="/sign-in"
				title={m.sign_in_button()}
				aria-label={m.sign_in_button()}
			>
				<LogIn size={18} aria-hidden="true" />
			</a>
		{/if}
	</nav>
</header>

<style>
	/* One control metric for every inner header element. */
	.header-brand,
	.header-btn {
		display: grid;
		flex: none;
		width: 2.5rem;
		height: 2.5rem;
		place-items: center;
		border-radius: var(--radius-lg);
		transition:
			border-color 140ms ease,
			background-color 140ms ease,
			color 140ms ease,
			opacity 140ms ease;
	}

	.header-brand img {
		width: 1.9rem;
		height: 1.9rem;
	}

	.header-brand:hover {
		opacity: 0.75;
	}

	.header-brand:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}

	.header-search-slot {
		display: flex;
		min-width: 0;
		flex: 1;
	}

	.header-actions {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.5rem;
	}

	.header-actions form {
		display: flex;
	}

	.header-btn {
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
		color: var(--text-secondary);
		cursor: pointer;
	}

	.header-btn:hover {
		border-color: color-mix(in oklab, var(--action) 55%, var(--border-subtle));
		background: var(--surface-selected);
		color: var(--text-primary);
	}

	.header-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.header-btn--danger:hover {
		border-color: color-mix(in oklab, var(--danger) 55%, var(--border-subtle));
		background: var(--danger-subtle);
		color: var(--danger);
	}

	@media (max-width: 42rem) {
		.header-brand,
		.header-btn {
			width: 2.25rem;
			height: 2.25rem;
		}

		.header-brand img {
			width: 1.7rem;
			height: 1.7rem;
		}

		.header-actions {
			gap: 0.4rem;
		}
	}
</style>
