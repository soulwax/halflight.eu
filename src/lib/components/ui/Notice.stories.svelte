<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Notice from './Notice.svelte';

	const { Story } = defineMeta({
		title: 'UI/Notice',
		component: Notice,
		tags: ['autodocs'],
		argTypes: {
			tone: { control: 'select', options: ['info', 'success', 'warning', 'danger'] }
		},
		args: { tone: 'info' }
	});
</script>

<Story name="Info" asChild>
	<Notice>Halflight is no longer connected to TIDAL.</Notice>
</Story>

<Story name="Success" asChild>
	<Notice tone="success">Connected. Your library is syncing now.</Notice>
</Story>

<Story name="Warning" asChild>
	<Notice tone="warning">
		Reconnect TIDAL before saving playlists — the write token has expired.
	</Notice>
</Story>

<Story name="Danger" asChild>
	<Notice tone="danger">That search could not be completed. Try again in a moment.</Notice>
</Story>

<Story name="All four tones" asChild>
	<!--
		The reason the icon is not optional: two of the routes this component
		replaced told success and failure apart by text colour alone. Read this
		stack with colour removed and every line still says what it is.
	-->
	<div style="display: grid; gap: 0.75rem;">
		<Notice>Halflight is no longer connected to TIDAL.</Notice>
		<Notice tone="success">Connected. Your library is syncing now.</Notice>
		<Notice tone="warning">Reconnect TIDAL before saving playlists.</Notice>
		<Notice tone="danger">That search could not be completed.</Notice>
	</div>
</Story>

<Story name="Long German copy wraps under the icon" asChild>
	<div style="max-width: 26rem;">
		<Notice tone="warning">
			Verbinde TIDAL erneut, bevor du Playlists speicherst — das Schreib-Token ist abgelaufen und
			Änderungen an deiner Mediathek werden bis dahin nicht übernommen.
		</Notice>
	</div>
</Story>
