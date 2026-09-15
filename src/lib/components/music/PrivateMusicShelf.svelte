<script lang="ts">
	import { Download, FileAudio, LoaderCircle, Music2, Trash2, Upload } from '@lucide/svelte';
	import Notice from '#lib/components/ui/Notice.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import {
		privateMusicAccept,
		privateMusicDownloadUrl,
		type PrivateMusicFile,
		type PrivateMusicLibraryData,
		type PrivateMusicStorage
	} from '#lib/private-music';

	type NoticeTone = 'info' | 'success' | 'warning' | 'danger';
	type UploadState = { status: 'idle' } | { status: 'uploading'; percent: number };

	let {
		library,
		headingId = 'private-music-title'
	}: { library: PrivateMusicLibraryData; headingId?: string } = $props();

	// The page data is the initial server snapshot. Uploads and deletions update this
	// local view optimistically, while a navigation supplies a fresh component snapshot.
	// svelte-ignore state_referenced_locally
	let files = $state<PrivateMusicFile[]>(library.files);
	// svelte-ignore state_referenced_locally
	let storage = $state<PrivateMusicStorage>(library.storage);
	let isDropTarget = $state(false);
	let uploadState = $state<UploadState>({ status: 'idle' });
	let feedback = $state<{ tone: NoticeTone; message: string } | null>(null);
	let fileInput = $state<HTMLInputElement>();
	let deleteDialog = $state<HTMLDialogElement>();
	let pendingDelete = $state<PrivateMusicFile | null>(null);

	const accept = $derived(privateMusicAccept(library.formats));
	const isUploading = $derived(uploadState.status === 'uploading');

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		const units = ['KiB', 'MiB', 'GiB'];
		const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) - 1, units.length - 1);
		return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / 1024 ** (index + 1))} ${units[index]}`;
	}

	function formatDate(value: string): string {
		return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
	}

	function formatLabel(file: PrivateMusicFile): string {
		return (
			library.formats.find((format) => format.contentType === file.contentType)?.label ??
			file.contentType
		);
	}

	function selectFile(): void {
		fileInput?.click();
	}

	function uploadSelected(event: Event): void {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		(event.currentTarget as HTMLInputElement).value = '';
		if (file) upload(file);
	}

	function dropFile(event: DragEvent): void {
		event.preventDefault();
		isDropTarget = false;
		const file = event.dataTransfer?.files[0];
		if (file) upload(file);
	}

	function isPrivateMusicFile(value: unknown): value is PrivateMusicFile {
		if (!value || typeof value !== 'object') return false;
		const candidate = value as Record<string, unknown>;
		return (
			typeof candidate.id === 'string' &&
			typeof candidate.fileName === 'string' &&
			typeof candidate.contentType === 'string' &&
			typeof candidate.sizeBytes === 'number' &&
			typeof candidate.createdAt === 'string' &&
			typeof candidate.downloadUrl === 'string'
		);
	}

	function upload(file: File): void {
		if (!library.enabled || isUploading) return;
		if (file.size > storage.maxFileBytes || file.size > storage.availableBytes) {
			feedback = { tone: 'danger', message: m.private_music_upload_error() };
			return;
		}

		feedback = null;
		uploadState = { status: 'uploading', percent: 0 };
		const request = new XMLHttpRequest();
		request.open('POST', '/api/private-music');
		request.responseType = 'json';
		request.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				uploadState = {
					status: 'uploading',
					percent: Math.round((event.loaded / event.total) * 100)
				};
			}
		};
		request.onerror = () => {
			uploadState = { status: 'idle' };
			feedback = { tone: 'danger', message: m.private_music_upload_error() };
		};
		request.onload = () => {
			uploadState = { status: 'idle' };
			if (request.status !== 201 || !isPrivateMusicFile(request.response)) {
				feedback = { tone: 'danger', message: m.private_music_upload_error() };
				return;
			}
			files = [request.response, ...files];
			storage = {
				...storage,
				fileCount: storage.fileCount + 1,
				usedBytes: storage.usedBytes + request.response.sizeBytes,
				availableBytes: Math.max(0, storage.availableBytes - request.response.sizeBytes)
			};
			feedback = { tone: 'success', message: m.private_music_upload_success() };
		};
		const form = new FormData();
		form.set('file', file);
		request.send(form);
	}

	function requestDeletion(file: PrivateMusicFile): void {
		pendingDelete = file;
		deleteDialog?.showModal();
	}

	async function confirmDeletion(): Promise<void> {
		if (!pendingDelete) return;
		const file = pendingDelete;
		try {
			const response = await fetch(file.downloadUrl, { method: 'DELETE' });
			if (!response.ok) throw new Error('Private music deletion failed');
			files = files.filter((candidate) => candidate.id !== file.id);
			storage = {
				...storage,
				fileCount: Math.max(0, storage.fileCount - 1),
				usedBytes: Math.max(0, storage.usedBytes - file.sizeBytes),
				availableBytes: Math.min(storage.maxTotalBytes, storage.availableBytes + file.sizeBytes)
			};
			feedback = { tone: 'success', message: m.private_music_delete_success() };
			deleteDialog?.close();
		} catch {
			feedback = { tone: 'danger', message: m.private_music_delete_error() };
		}
	}
</script>

<section class="private-music" aria-labelledby={headingId}>
	<div class="private-music-heading">
		<div>
			<p class="eyebrow">{m.private_music_eyebrow()}</p>
			<h2 id={headingId}>{m.private_music_title()}</h2>
			<p>{m.private_music_description()}</p>
		</div>
		<div
			class="storage"
			aria-label={m.private_music_storage({
				used: formatBytes(storage.usedBytes),
				total: formatBytes(storage.maxTotalBytes)
			})}
		>
			<span class="accent-icon"><Music2 size={18} aria-hidden="true" /></span>
			<span
				>{m.private_music_storage({
					used: formatBytes(storage.usedBytes),
					total: formatBytes(storage.maxTotalBytes)
				})}</span
			>
		</div>
	</div>

	{#if !library.enabled}
		<Notice tone="warning">{m.private_music_storage_unavailable()}</Notice>
	{:else}
		<div
			class="drop-zone"
			class:drop-zone-active={isDropTarget}
			role="group"
			aria-label={m.private_music_upload_title()}
			aria-busy={isUploading}
			ondragenter={(event) => {
				event.preventDefault();
				isDropTarget = true;
			}}
			ondragover={(event) => event.preventDefault()}
			ondragleave={() => (isDropTarget = false)}
			ondrop={dropFile}
		>
			<span class="accent-icon"><Upload size={24} aria-hidden="true" /></span>
			<div>
				<strong>{m.private_music_upload_title()}</strong>
				<p>
					{m.private_music_upload_hint({
						formats: library.formats.map((format) => format.label).join(' · ')
					})}
				</p>
			</div>
			<button type="button" onclick={selectFile} disabled={isUploading}>
				{#if uploadState.status === 'uploading'}
					<LoaderCircle size={16} class="animate-spin" aria-hidden="true" />
					{m.private_music_uploading({ percent: uploadState.percent })}
				{:else}
					{m.private_music_upload_action()}
				{/if}
			</button>
			<input bind:this={fileInput} class="sr-only" type="file" {accept} onchange={uploadSelected} />
			{#if uploadState.status === 'uploading'}
				<progress value={uploadState.percent} max="100">{uploadState.percent}%</progress>
			{/if}
		</div>
	{/if}

	{#if feedback}
		<Notice tone={feedback.tone}>{feedback.message}</Notice>
	{/if}

	{#if files.length === 0}
		<p class="empty">
			<span class="accent-icon"><FileAudio size={20} aria-hidden="true" /></span>
			{m.private_music_empty()}
		</p>
	{:else}
		<ul class="private-music-list">
			{#each files as file (file.id)}
				<li>
					<div class="file-copy">
						<span class="accent-icon"><FileAudio size={20} aria-hidden="true" /></span>
						<div>
							<strong>{file.fileName}</strong>
							<p>
								{formatLabel(file)} · {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
							</p>
						</div>
					</div>
					<audio
						controls
						preload="none"
						src={file.downloadUrl}
						aria-label={m.private_music_listen({ file: file.fileName })}
					></audio>
					<div class="file-actions">
						<a
							href={privateMusicDownloadUrl(file)}
							download={file.fileName}
							aria-label={m.private_music_download({ file: file.fileName })}
						>
							<Download size={17} aria-hidden="true" />
						</a>
						<button
							type="button"
							onclick={() => requestDeletion(file)}
							aria-label={m.private_music_delete({ file: file.fileName })}
						>
							<Trash2 size={17} aria-hidden="true" />
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<dialog
	bind:this={deleteDialog}
	onclose={() => (pendingDelete = null)}
	aria-labelledby="private-music-delete-title"
>
	<h2 id="private-music-delete-title">
		{m.private_music_delete_confirm({ file: pendingDelete?.fileName ?? '' })}
	</h2>
	<div class="dialog-actions">
		<button type="button" onclick={() => deleteDialog?.close()}
			>{m.private_music_delete_cancel()}</button
		>
		<button type="button" class="danger" onclick={() => void confirmDeletion()}
			>{m.private_music_delete_action()}</button
		>
	</div>
</dialog>

<style>
	.private-music {
		display: grid;
		gap: 1rem;
		padding: var(--space-panel);
		border: var(--module-border);
		border-radius: var(--module-radius);
		background: var(--module-bg);
		box-shadow: var(--module-shadow);
	}
	.private-music-heading,
	.file-copy,
	.file-actions,
	.dialog-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.private-music-heading {
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}
	.eyebrow,
	.private-music h2,
	.private-music p {
		margin: 0;
	}
	.eyebrow {
		font-size: var(--fs-xs);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--action);
	}
	.private-music h2 {
		margin-top: 0.2rem;
		font-size: var(--fs-lg);
	}
	.private-music-heading p,
	.file-copy p,
	.empty {
		color: var(--text-muted);
	}
	.storage {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex: none;
		font-size: var(--fs-sm);
		color: var(--text-secondary);
	}
	.accent-icon {
		display: inline-flex;
		color: var(--action);
		flex: none;
	}
	.drop-zone {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.9rem;
		align-items: center;
		padding: 1rem;
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius-md);
		background: color-mix(in oklab, var(--surface-selected) 35%, var(--surface-raised));
		transition:
			background var(--dur-fast) var(--ease-out),
			border-color var(--dur-fast) var(--ease-out);
	}
	.drop-zone-active {
		border-color: var(--action);
		background: var(--surface-selected);
	}
	.drop-zone p {
		margin-top: 0.2rem;
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}
	button,
	.file-actions a {
		display: inline-flex;
		min-height: 2.5rem;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 0.5rem 0.75rem;
		background: var(--surface-raised);
		color: var(--text-primary);
		font: inherit;
		text-decoration: none;
		cursor: pointer;
	}
	.drop-zone button {
		border-color: var(--action);
		background: var(--action);
		color: var(--action-contrast);
	}
	button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	progress {
		grid-column: 1 / -1;
		width: 100%;
		accent-color: var(--action);
	}
	.empty {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 0;
	}
	.private-music-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.private-music-list li {
		display: grid;
		grid-template-columns: minmax(11rem, 1fr) minmax(12rem, 1.2fr) auto;
		gap: 1rem;
		align-items: center;
		padding: 0.9rem 0;
		border-top: 1px solid var(--border-subtle);
	}
	.file-copy {
		min-width: 0;
	}
	.file-copy div {
		min-width: 0;
	}
	.file-copy strong,
	.file-copy p {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.file-copy p {
		margin-top: 0.15rem;
		font-size: var(--fs-sm);
	}
	audio {
		width: 100%;
		height: 2.5rem;
	}
	.file-actions {
		justify-content: end;
	}
	.file-actions button {
		color: var(--danger);
	}
	dialog {
		margin: auto;
		width: min(30rem, calc(100% - 2rem));
		border: var(--module-border);
		border-radius: var(--module-radius);
		padding: 1.5rem;
		background: var(--surface-raised);
		color: var(--text-primary);
		box-shadow: var(--shadow-float);
	}
	dialog::backdrop {
		background: var(--overlay);
	}
	dialog h2 {
		margin: 0 0 1.25rem;
		font-size: var(--fs-md);
	}
	.dialog-actions {
		justify-content: flex-end;
		flex-wrap: wrap;
	}
	.dialog-actions .danger {
		border-color: var(--danger);
		background: var(--danger);
		color: var(--scrim-ink);
	}
	@media (max-width: 44rem) {
		.private-music-heading,
		.drop-zone {
			align-items: flex-start;
			grid-template-columns: auto minmax(0, 1fr);
		}
		.storage,
		.drop-zone button {
			grid-column: 1 / -1;
		}
		.private-music-list li {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		audio {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
</style>
