<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		AlertTriangle,
		CheckCircle2,
		Download,
		Info,
		Pin,
		RefreshCw,
		RotateCcw,
		Sparkles,
		Trash2,
		XCircle
	} from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';

	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let isRebuilding = $state(false);
</script>

<svelte:head>
	<title>Taste Profile — Syn</title>
</svelte:head>

<section class="max-w-4xl space-y-8" aria-labelledby="taste-profile-title">
	<header class="border-b-2 border-[var(--border-subtle)] pb-6">
		<p class="font-mono text-xs font-bold tracking-[0.14em] text-[var(--text-muted)] uppercase">
			SYN // TASTE ENGINE
		</p>
		<h1
			id="taste-profile-title"
			class="mt-1 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl"
		>
			Taste Profile
		</h1>
		<p class="mt-2 text-sm text-[var(--text-muted)]">
			Derived weights and identifiers that anchor your listening room. Completely deterministic,
			zero external AI, never shared.
		</p>
	</header>

	{#if form?.error}
		<div
			class="flex items-center gap-3 border border-[var(--danger)] bg-[var(--danger-subtle)] p-4 text-sm text-[var(--text-primary)]"
			role="alert"
		>
			<AlertTriangle size={18} class="shrink-0 text-[var(--danger)]" />
			<p>{form.error}</p>
		</div>
	{/if}

	{#if form?.message}
		<div
			class="flex items-center gap-3 border border-[var(--accent-jade)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--text-primary)]"
			role="status"
		>
			<CheckCircle2 size={18} class="shrink-0 text-[var(--accent-jade)]" />
			<p>{form.message}</p>
		</div>
	{/if}

	<!-- Plain Language Summary Card -->
	<section
		class="relative overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6"
		aria-labelledby="plain-language-heading"
	>
		<div class="absolute top-0 left-0 h-1 w-full bg-[var(--accent-gold)]"></div>
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<Sparkles size={20} class="text-[var(--accent-gold)]" />
				<h2 id="plain-language-heading" class="text-lg font-bold tracking-tight">
					How the Engine Reads You
				</h2>
			</div>
			<Badge variant={data.sentences.confidenceLevel === 'high' ? 'accent' : 'tag'}>
				{data.sentences.confidenceLevel.toUpperCase()} CONFIDENCE ({data.sentences
					.confidenceScore}%)
			</Badge>
		</div>

		<div class="mt-4 space-y-3 font-serif text-base leading-relaxed text-[var(--text-primary)]">
			<p class="rounded border-l-2 border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-3">
				{data.sentences.artistSentence}
			</p>
			<p class="rounded border-l-2 border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-3">
				{data.sentences.eraSentence}
			</p>
			<p
				class="rounded border-l-2 border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-3 text-sm text-[var(--text-muted)]"
			>
				{data.sentences.confidenceSentence}
			</p>
		</div>

		<div class="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
			<form
				method="POST"
				action="?/rebuild"
				use:enhance={() => {
					isRebuilding = true;
					return async ({ update }) => {
						isRebuilding = false;
						await update();
					};
				}}
			>
				<Button
					type="submit"
					variant="primary"
					size="sm"
					disabled={isRebuilding || !data.connection.connected}
				>
					<RefreshCw size={14} class={`mr-1.5 ${isRebuilding ? 'animate-spin' : ''}`} />
					{isRebuilding ? 'Refreshing from TIDAL…' : 'Rebuild Profile from TIDAL'}
				</Button>
			</form>

			<a
				href={resolve('/api/taste/profile')}
				download="syn-taste-profile.json"
				class="inline-flex items-center gap-1.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)]"
			>
				<Download size={13} />
				Export JSON
			</a>
		</div>
	</section>

	<!-- Anchor Artists Section -->
	<section class="space-y-4" aria-labelledby="anchor-artists-heading">
		<div class="flex items-center justify-between">
			<div>
				<h2 id="anchor-artists-heading" class="text-xl font-bold tracking-tight">Anchor Artists</h2>
				<p class="text-xs text-[var(--text-muted)]">
					Explicitly followed artists and recurrent playlist anchors. You can pin, dampen, or
					exclude any artist.
				</p>
			</div>
		</div>

		{#if data.anchorArtists.length === 0}
			<div
				class="border border-dashed border-[var(--border-subtle)] p-6 text-center text-sm text-[var(--text-muted)]"
			>
				No anchor artists found in your profile. Rebuild your profile while connected to TIDAL.
			</div>
		{:else}
			<div
				class="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] bg-[var(--surface-raised)]"
			>
				{#each data.anchorArtists as artist (artist.id)}
					<div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="truncate font-bold text-[var(--text-primary)]">{artist.name}</span>
								{#if artist.status === 'pinned'}
									<span
										class="rounded bg-[var(--accent-gold)] px-1.5 py-0.5 text-[0.65rem] font-bold text-black uppercase"
									>
										Pinned
									</span>
								{:else if artist.status === 'dampened'}
									<span
										class="rounded border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--text-muted)] uppercase"
									>
										Dampened
									</span>
								{/if}
							</div>
							<div class="mt-1.5 flex items-center gap-2">
								<div class="h-1.5 w-32 overflow-hidden rounded bg-[var(--surface-canvas)]">
									<div
										class="h-full bg-[var(--action)]"
										style="width: {Math.round(artist.weight * 100)}%"
									></div>
								</div>
								<span class="font-mono text-[0.7rem] text-[var(--text-muted)]">
									{Math.round(artist.weight * 100)}% affinity
								</span>
							</div>
						</div>

						<div class="flex items-center gap-2">
							{#if artist.status !== 'pinned'}
								<form method="POST" action="?/overrideArtist" use:enhance>
									<input type="hidden" name="artistId" value={artist.id} />
									<input type="hidden" name="mode" value="pinned" />
									<Button
										type="submit"
										variant="secondary"
										size="sm"
										title="Pin artist at maximum weight"
									>
										<Pin size={12} class="mr-1" />
										Pin
									</Button>
								</form>
							{:else}
								<form method="POST" action="?/overrideArtist" use:enhance>
									<input type="hidden" name="artistId" value={artist.id} />
									<input type="hidden" name="mode" value="normal" />
									<Button
										type="submit"
										variant="secondary"
										size="sm"
										title="Reset to natural weight"
									>
										Unpin
									</Button>
								</form>
							{/if}

							{#if artist.status !== 'dampened'}
								<form method="POST" action="?/overrideArtist" use:enhance>
									<input type="hidden" name="artistId" value={artist.id} />
									<input type="hidden" name="mode" value="dampened" />
									<Button
										type="submit"
										variant="secondary"
										size="sm"
										title="Dampen artist influence (25%)"
									>
										Dampen
									</Button>
								</form>
							{:else}
								<form method="POST" action="?/overrideArtist" use:enhance>
									<input type="hidden" name="artistId" value={artist.id} />
									<input type="hidden" name="mode" value="normal" />
									<Button
										type="submit"
										variant="secondary"
										size="sm"
										title="Restore natural weight"
									>
										Undampen
									</Button>
								</form>
							{/if}

							<form method="POST" action="?/excludeArtist" use:enhance>
								<input type="hidden" name="artistId" value={artist.id} />
								<button
									type="submit"
									class="inline-flex items-center gap-1 border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--danger)] hover:border-[var(--danger)]"
									title="Completely exclude this artist from future generations"
								>
									<XCircle size={12} />
									Exclude
								</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Excluded Artists Section (if any) -->
	{#if data.excludedArtists.length > 0}
		<section class="space-y-3" aria-labelledby="exclusions-heading">
			<h2 id="exclusions-heading" class="text-base font-bold tracking-tight text-[var(--danger)]">
				Excluded Artists ({data.excludedArtists.length})
			</h2>
			<div class="flex flex-wrap gap-2">
				{#each data.excludedArtists as artist (artist.id)}
					<form method="POST" action="?/removeExclusion" use:enhance class="inline-block">
						<input type="hidden" name="artistId" value={artist.id} />
						<button
							type="submit"
							class="group inline-flex items-center gap-1.5 rounded border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2.5 py-1 text-xs text-[var(--text-primary)] hover:border-[var(--accent-gold)]"
							title="Click to restore this artist"
						>
							<span>{artist.name}</span>
							<RotateCcw
								size={11}
								class="text-[var(--text-muted)] group-hover:text-[var(--accent-gold)]"
							/>
						</button>
					</form>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Era Preferences Section -->
	<section class="space-y-4" aria-labelledby="eras-heading">
		<div>
			<h2 id="eras-heading" class="text-xl font-bold tracking-tight">Decade Distribution</h2>
			<p class="text-xs text-[var(--text-muted)]">
				Derived from release years across your collection and playlist history.
			</p>
		</div>

		{#if data.eraDistribution.length === 0}
			<div
				class="border border-dashed border-[var(--border-subtle)] p-6 text-center text-sm text-[var(--text-muted)]"
			>
				No era history detected yet.
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
				{#each data.eraDistribution as era (era.decade)}
					<div class="border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3.5">
						<div class="flex items-center justify-between text-xs">
							<span class="font-bold">{era.decade}s</span>
							<span class="font-mono text-[var(--text-muted)]">{era.percentage}%</span>
						</div>
						<div class="mt-2 h-1.5 w-full overflow-hidden rounded bg-[var(--surface-canvas)]">
							<div class="h-full bg-[var(--accent-gold)]" style="width: {era.percentage}%"></div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Profile Lifecycle & Privacy Actions -->
	<section
		class="space-y-4 border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6"
		aria-labelledby="disposability-heading"
	>
		<div class="flex items-center gap-2">
			<Info size={18} class="text-[var(--text-muted)]" />
			<h2 id="disposability-heading" class="text-base font-bold">Data Disposability & Privacy</h2>
		</div>
		<p class="text-xs leading-relaxed text-[var(--text-muted)]">
			Syn never mirrors your TIDAL catalogue. Your taste profile stores only numerical weights and
			TIDAL identifiers. It can be wiped or reset at any time with immediate effect.
		</p>

		<div class="flex flex-wrap items-center gap-3 pt-2">
			<form
				method="POST"
				action="?/reset"
				use:enhance
				onsubmit={(e) => {
					if (!confirm('Reset all learned weights and overrides to blank defaults?')) {
						e.preventDefault();
					}
				}}
			>
				<Button type="submit" variant="secondary" size="sm">
					<RotateCcw size={13} class="mr-1.5" />
					Reset to Blank Defaults
				</Button>
			</form>

			<form
				method="POST"
				action="?/delete"
				use:enhance
				onsubmit={(e) => {
					if (!confirm('Permanently delete your taste profile record from Syn database?')) {
						e.preventDefault();
					}
				}}
			>
				<button
					type="submit"
					class="inline-flex items-center gap-1.5 border border-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-subtle)]"
				>
					<Trash2 size={13} />
					Delete Profile Row
				</button>
			</form>
		</div>
	</section>
</section>
