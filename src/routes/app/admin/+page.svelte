<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Shield,
		ShieldAlert,
		ShieldCheck,
		Users,
		Activity,
		Database,
		Server,
		Trash2,
		UserX,
		Archive,
		UserCheck,
		UserPlus,
		Search,
		CheckCircle2,
		AlertTriangle,
		RefreshCw,
		Sparkles
	} from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let activeTab = $state<'overview' | 'users'>('overview');
	let searchQuery = $state('');
	let showCreateModal = $state(false);

	let filteredUsers = $derived(
		data.users.filter((u) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase();
			return (
				u.name?.toLowerCase().includes(q) ||
				u.email?.toLowerCase().includes(q) ||
				u.id.toLowerCase().includes(q) ||
				u.adminRole?.toLowerCase().includes(q)
			);
		})
	);

	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / (3600 * 24));
		const hours = Math.floor((seconds % (3600 * 24)) / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		if (days > 0) return `${days}d ${hours}h ${minutes}m`;
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m ${seconds % 60}s`;
	}

	function formatDate(date: Date | string | null | undefined): string {
		if (!date) return '—';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{m.admin_panel_title()} — {m.brand_name()}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-8 p-4 sm:p-8">
	<!-- Page Header -->
	<div
		class="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-6 sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="space-y-1">
			<div class="flex items-center gap-2.5">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--action)]"
				>
					<Shield size={20} />
				</div>
				<h1 class="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
					{m.admin_panel_title()}
				</h1>
			</div>
			<p class="text-sm text-[var(--text-secondary)]">
				{m.admin_panel_subtitle()}
			</p>
		</div>

		<!-- Tab Switcher -->
		<div
			class="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-1"
		>
			<button
				type="button"
				class="flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors {activeTab ===
				'overview'
					? 'bg-[var(--action)] text-black'
					: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
				onclick={() => (activeTab = 'overview')}
			>
				<Activity size={14} />
				{m.admin_tab_overview()}
			</button>
			<button
				type="button"
				class="flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors {activeTab ===
				'users'
					? 'bg-[var(--action)] text-black'
					: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
				onclick={() => (activeTab = 'users')}
			>
				<Users size={14} />
				{m.admin_tab_users()}
				<span
					class="py-0.2 ml-1 rounded-full bg-[var(--surface-raised)] px-1.5 text-[10px] {activeTab ===
					'users'
						? 'text-black'
						: 'text-[var(--text-muted)]'}"
				>
					{data.users.length}
				</span>
			</button>
		</div>
	</div>

	<!-- Status / Action Notifications -->
	{#if form?.error}
		<div
			class="flex items-center gap-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]"
		>
			<AlertTriangle size={18} class="shrink-0" />
			<span>{form.error}</span>
		</div>
	{/if}
	{#if form?.message}
		<div
			class="flex items-center gap-3 rounded-lg border border-[var(--accent-jade)]/30 bg-[var(--accent-jade)]/10 px-4 py-3 text-sm text-[var(--accent-jade)]"
		>
			<CheckCircle2 size={18} class="shrink-0" />
			<span>{form.message}</span>
		</div>
	{/if}

	<!-- Tab 1: Global Info & System Health -->
	{#if activeTab === 'overview'}
		<div class="space-y-8">
			<!-- Metrics Grid -->
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<div class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
					<div class="flex items-center justify-between text-[var(--text-muted)]">
						<span class="text-xs font-bold tracking-wider uppercase">{m.admin_stat_users()}</span>
						<Users size={16} />
					</div>
					<div class="mt-3 text-3xl font-black text-[var(--text-primary)]">
						{data.globalInfo.userCount}
					</div>
				</div>

				<div class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
					<div class="flex items-center justify-between text-[var(--text-muted)]">
						<span class="text-xs font-bold tracking-wider uppercase">{m.admin_stat_admins()}</span>
						<ShieldCheck size={16} class="text-[var(--action)]" />
					</div>
					<div class="mt-3 text-3xl font-black text-[var(--action)]">
						{data.globalInfo.adminCount}
					</div>
				</div>

				<div class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
					<div class="flex items-center justify-between text-[var(--text-muted)]">
						<span class="text-xs font-bold tracking-wider uppercase"
							>{m.admin_stat_playlists()}</span
						>
						<Sparkles size={16} />
					</div>
					<div class="mt-3 text-3xl font-black text-[var(--text-primary)]">
						{data.globalInfo.playlistCount}
					</div>
				</div>

				<div class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
					<div class="flex items-center justify-between text-[var(--text-muted)]">
						<span class="text-xs font-bold tracking-wider uppercase">{m.admin_stat_uptime()}</span>
						<Server size={16} />
					</div>
					<div class="mt-3 font-mono text-2xl font-black text-[var(--text-primary)]">
						{formatUptime(data.globalInfo.uptimeSeconds)}
					</div>
				</div>
			</div>

			<!-- System & Health Details -->
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<!-- Server & Runtime Health -->
				<div
					class="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6"
				>
					<div class="flex items-center gap-2 text-[var(--text-primary)]">
						<Server size={18} class="text-[var(--action)]" />
						<h3 class="font-bold tracking-tight">Runtime & Server Environment</h3>
					</div>
					<dl class="divide-y divide-[var(--border-subtle)]/50 text-sm">
						<div class="flex justify-between py-2.5">
							<dt class="text-[var(--text-muted)]">Node.js Version</dt>
							<dd class="font-mono text-[var(--text-primary)]">{data.globalInfo.nodeVersion}</dd>
						</div>
						<div class="flex justify-between py-2.5">
							<dt class="text-[var(--text-muted)]">OS Platform</dt>
							<dd class="font-mono text-[var(--text-primary)]">{data.globalInfo.platform}</dd>
						</div>
						<div class="flex justify-between py-2.5">
							<dt class="text-[var(--text-muted)]">Memory (RSS)</dt>
							<dd class="font-mono text-[var(--text-primary)]">{data.globalInfo.memoryRssMb} MB</dd>
						</div>
						<div class="flex justify-between py-2.5">
							<dt class="text-[var(--text-muted)]">Memory (Heap Used / Total)</dt>
							<dd class="font-mono text-[var(--text-primary)]">
								{data.globalInfo.memoryHeapUsedMb} MB / {data.globalInfo.memoryHeapTotalMb} MB
							</dd>
						</div>
					</dl>
				</div>

				<!-- Database & Integrations -->
				<div
					class="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6"
				>
					<div class="flex items-center gap-2 text-[var(--text-primary)]">
						<Database size={18} class="text-[var(--accent-jade)]" />
						<h3 class="font-bold tracking-tight">Database & Provider Integrations</h3>
					</div>
					<dl class="divide-y divide-[var(--border-subtle)]/50 text-sm">
						<div class="flex justify-between py-2.5">
							<dt class="text-[var(--text-muted)]">PostgreSQL Latency</dt>
							<dd
								class="flex items-center gap-1.5 font-mono {data.globalInfo.dbLatencyMs >= 0
									? 'text-[var(--accent-jade)]'
									: 'text-[var(--danger)]'}"
								title={data.globalInfo.dbLatencyMs >= 0
									? `${data.globalInfo.dbLatencyMs} ms query latency`
									: 'Database query error'}
							>
								<span
									class="h-2 w-2 rounded-full {data.globalInfo.dbLatencyMs >= 0
										? 'bg-[var(--accent-jade)]'
										: 'bg-[var(--danger)]'}"
								></span>
								{data.globalInfo.dbLatencyMs >= 0 ? `${data.globalInfo.dbLatencyMs} ms` : 'Error'}
							</dd>
						</div>
						<div class="flex justify-between py-2.5">
							<dt class="text-[var(--text-muted)]">{m.admin_stat_tidal()}</dt>
							<dd class="flex items-center gap-1.5">
								<span
									class="h-2 w-2 rounded-full {data.globalInfo.tidal.connected
										? 'bg-[var(--accent-jade)]'
										: 'bg-[var(--danger)]'}"
								></span>
								<span class="text-[var(--text-primary)]">
									{data.globalInfo.tidal.connected
										? 'Connected'
										: data.globalInfo.tidal.configured
											? 'Configured (Disconnected)'
											: 'Not configured'}
								</span>
							</dd>
						</div>
						<div class="flex justify-between py-2.5">
							<dt class="text-[var(--text-muted)]">TIDAL Write Permissions</dt>
							<dd
								class="font-mono {data.globalInfo.tidal.hasWriteScopes
									? 'text-[var(--accent-jade)]'
									: 'text-[var(--text-muted)]'}"
							>
								{data.globalInfo.tidal.hasWriteScopes
									? 'Granted (Two-Way Sync Active)'
									: 'Read-Only'}
							</dd>
						</div>
						<div class="flex justify-between py-2.5">
							<dt class="text-[var(--text-muted)]">Linked TIDAL Accounts</dt>
							<dd class="font-mono text-[var(--text-primary)]">{data.globalInfo.tidalAuthCount}</dd>
						</div>
					</dl>
				</div>
			</div>
		</div>
	{/if}

	<!-- Tab 2: User Management -->
	{#if activeTab === 'users'}
		<div class="space-y-6">
			<!-- Controls Bar -->
			<div class="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
				<div class="relative max-w-md flex-1">
					<Search
						size={16}
						class="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-muted)]"
					/>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Filter by name, email, role, or ID..."
						class="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] py-2 pr-4 pl-9 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--action)]"
					/>
				</div>

				<Button variant="primary" size="sm" onclick={() => (showCreateModal = !showCreateModal)}>
					<UserPlus size={15} class="mr-1.5" />
					{m.admin_create_user()}
				</Button>
			</div>

			<!-- Create User Form (Expandable) -->
			{#if showCreateModal}
				<div
					class="rounded-xl border border-[var(--action)]/40 bg-[var(--surface-raised)] p-6 transition-all"
				>
					<div
						class="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4"
					>
						<h3 class="flex items-center gap-2 font-bold text-[var(--text-primary)]">
							<UserPlus size={18} class="text-[var(--action)]" />
							{m.admin_create_user()}
						</h3>
						<button
							type="button"
							class="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
							onclick={() => (showCreateModal = false)}
						>
							{m.admin_close()}
						</button>
					</div>

					<form
						method="POST"
						action="?/createUser"
						use:enhance
						class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3"
					>
						<div class="space-y-1.5">
							<label
								for="create-name"
								class="text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase"
							>
								{m.admin_name_label()}
							</label>
							<input
								id="create-name"
								name="name"
								type="text"
								required
								class="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)]"
							/>
						</div>

						<div class="space-y-1.5">
							<label
								for="create-email"
								class="text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase"
							>
								{m.admin_email_label()}
							</label>
							<input
								id="create-email"
								name="email"
								type="email"
								required
								class="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)]"
							/>
						</div>

						<div class="space-y-1.5">
							<label
								for="create-password"
								class="text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase"
							>
								{m.admin_password_label()}
							</label>
							<input
								id="create-password"
								name="password"
								type="password"
								required
								minlength="8"
								class="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-primary)]"
							/>
						</div>

						<div class="flex items-center justify-between pt-2 sm:col-span-3">
							<label
								class="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]"
							>
								<input
									type="checkbox"
									name="makeAdmin"
									class="rounded border-[var(--border-subtle)] text-[var(--action)]"
								/>
								<span>{m.admin_make_admin_label()}</span>
							</label>

							<Button type="submit" variant="primary" size="sm">{m.admin_submit_create()}</Button>
						</div>
					</form>
				</div>
			{/if}

			<!-- Users Table -->
			<div
				class="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]"
			>
				<table class="w-full text-left text-sm">
					<thead
						class="border-b border-[var(--border-subtle)] bg-[var(--surface-canvas)]/50 text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase"
					>
						<tr>
							<th class="px-5 py-3.5">User</th>
							<th class="px-5 py-3.5">Role</th>
							<th class="px-5 py-3.5">Status</th>
							<th class="px-5 py-3.5">Registered</th>
							<th class="px-5 py-3.5 text-right">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--border-subtle)]">
						{#each filteredUsers as user (user.id)}
							<tr class="transition-colors hover:bg-[var(--surface-canvas)]/40">
								<!-- User info -->
								<td class="px-5 py-4">
									<div class="flex items-center gap-3">
										<div
											class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-xs font-bold text-[var(--text-primary)]"
										>
											{user.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
										</div>
										<div class="min-w-0">
											<div
												class="flex items-center gap-1.5 truncate font-semibold text-[var(--text-primary)]"
											>
												<span>{user.name}</span>
												{#if user.id === data.currentUserId}
													<span class="font-mono text-[10px] text-[var(--text-muted)]">(You)</span>
												{/if}
											</div>
											<div class="truncate font-mono text-xs text-[var(--text-muted)]">
												{user.email}
											</div>
										</div>
									</div>
								</td>

								<!-- Role -->
								<td class="px-5 py-4">
									{#if user.isFirstAdmin || user.adminRole === 'owner'}
										<span
											class="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold tracking-wider text-amber-400 uppercase"
										>
											<Shield size={12} class="mr-1 inline text-amber-400" />
											{m.admin_role_owner()}
										</span>
									{:else if user.adminRole === 'admin'}
										<span
											class="inline-flex items-center rounded-md border border-[var(--action)]/30 bg-[var(--action)]/10 px-2 py-0.5 text-xs font-semibold tracking-wider text-[var(--action)] uppercase"
										>
											<ShieldCheck size={12} class="mr-1 inline text-[var(--action)]" />
											{m.admin_role_admin()}
										</span>
									{:else}
										<span
											class="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2 py-0.5 text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase"
										>
											{m.admin_role_user()}
										</span>
									{/if}
								</td>

								<!-- Status -->
								<td class="px-5 py-4">
									{#if user.status === 'banned'}
										<span
											class="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--danger)]"
										>
											<span class="h-2 w-2 rounded-full bg-[var(--danger)]"></span>
											{m.admin_status_banned()}
										</span>
									{:else if user.status === 'archived'}
										<span
											class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400"
										>
											<span class="h-2 w-2 rounded-full bg-amber-400"></span>
											{m.admin_status_archived()}
										</span>
									{:else}
										<span
											class="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-jade)]"
										>
											<span class="h-2 w-2 rounded-full bg-[var(--accent-jade)]"></span>
											{m.admin_status_active()}
										</span>
									{/if}
								</td>

								<!-- Registered -->
								<td class="px-5 py-4 font-mono text-xs text-[var(--text-muted)]">
									{formatDate(user.createdAt)}
								</td>

								<!-- Actions -->
								<td class="px-5 py-4 text-right">
									<div class="flex items-center justify-end gap-1.5">
										<!-- Self protection: cannot modify self -->
										{#if user.id === data.currentUserId}
											<span class="text-xs text-[var(--text-muted)] italic">Self</span>
											<!-- First admin protection: no admin can touch first admin -->
										{:else if user.isFirstAdmin}
											<span class="font-mono text-xs text-[var(--text-muted)]">Protected Owner</span
											>
											<!-- Regular admin cannot touch another admin -->
										{:else if !data.isFirstAdmin && user.adminRole === 'admin'}
											<span class="font-mono text-xs text-[var(--text-muted)]">Peer Admin</span>
											<!-- Allowed actions -->
										{:else}
											<!-- Role Promotion / Demotion -->
											{#if user.adminRole === 'admin'}
												<form method="POST" action="?/demote" use:enhance class="inline">
													<input type="hidden" name="targetUserId" value={user.id} />
													<Button
														type="submit"
														variant="ghost"
														size="sm"
														title={m.admin_action_demote()}
														ariaLabel={m.admin_action_demote()}
													>
														<UserX size={14} class="text-[var(--danger)]" />
													</Button>
												</form>
											{:else}
												<form method="POST" action="?/promote" use:enhance class="inline">
													<input type="hidden" name="targetUserId" value={user.id} />
													<Button
														type="submit"
														variant="ghost"
														size="sm"
														title={m.admin_action_promote()}
														ariaLabel={m.admin_action_promote()}
													>
														<UserCheck size={14} class="text-[var(--action)]" />
													</Button>
												</form>
											{/if}

											<!-- Status toggles: Ban / Unban / Archive / Unarchive -->
											{#if user.status === 'banned'}
												<form method="POST" action="?/unban" use:enhance class="inline">
													<input type="hidden" name="targetUserId" value={user.id} />
													<Button
														type="submit"
														variant="ghost"
														size="sm"
														title={m.admin_action_unban()}
														ariaLabel={m.admin_action_unban()}
													>
														<RefreshCw size={14} class="text-[var(--accent-jade)]" />
													</Button>
												</form>
											{:else}
												<form method="POST" action="?/ban" use:enhance class="inline">
													<input type="hidden" name="targetUserId" value={user.id} />
													<Button
														type="submit"
														variant="ghost"
														size="sm"
														title={m.admin_action_ban()}
														ariaLabel={m.admin_action_ban()}
													>
														<ShieldAlert size={14} class="text-[var(--danger)]" />
													</Button>
												</form>
											{/if}

											{#if user.status === 'archived'}
												<form method="POST" action="?/unarchive" use:enhance class="inline">
													<input type="hidden" name="targetUserId" value={user.id} />
													<Button
														type="submit"
														variant="ghost"
														size="sm"
														title={m.admin_action_unarchive()}
														ariaLabel={m.admin_action_unarchive()}
													>
														<RefreshCw size={14} class="text-amber-400" />
													</Button>
												</form>
											{:else if user.status !== 'banned'}
												<form method="POST" action="?/archive" use:enhance class="inline">
													<input type="hidden" name="targetUserId" value={user.id} />
													<Button
														type="submit"
														variant="ghost"
														size="sm"
														title={m.admin_action_archive()}
														ariaLabel={m.admin_action_archive()}
													>
														<Archive size={14} class="text-amber-400" />
													</Button>
												</form>
											{/if}

											<!-- Kick (Delete User) -->
											<form
												method="POST"
												action="?/kick"
												use:enhance
												class="inline"
												onsubmit={(e) => {
													if (
														!confirm(
															`Are you sure you want to kick and delete account "${user.name}"?`
														)
													) {
														e.preventDefault();
													}
												}}
											>
												<input type="hidden" name="targetUserId" value={user.id} />
												<Button
													type="submit"
													variant="ghost"
													size="sm"
													title={m.admin_action_kick()}
													ariaLabel={m.admin_action_kick()}
												>
													<Trash2 size={14} class="text-[var(--danger)]" />
												</Button>
											</form>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
						{#if filteredUsers.length === 0}
							<tr>
								<td
									colspan="5"
									class="px-5 py-10 text-center text-sm text-[var(--text-muted)] italic"
								>
									{m.admin_no_users()}
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
