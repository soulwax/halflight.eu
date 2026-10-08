import {
	ArrowDown,
	ArrowUp,
	Disc3,
	ExternalLink,
	FolderPlus,
	Info,
	Link,
	ListPlus,
	ListStart,
	Play,
	Radio,
	Share2,
	SquareArrowOutUpRight,
	Trash2,
	UserRound
} from '@lucide/svelte';
import { goto } from '$app/navigation';
import { m } from '#lib/paraglide/messages.js';
import { isMobileRoute } from '#lib/mobile/routes';
import { player } from '#lib/player/player.svelte';
import { customPlaylists } from '#lib/player/customPlaylists.svelte';
import type { QueueEntry } from '#lib/player/queue-entry';
import type { TrackSummary } from '#lib/tidal/models';
import { contextMenu, type ContextAction } from './context-menu.svelte';

export type MediaKind = 'album' | 'artist' | 'playlist' | 'track';

/** Same destination on either site: `/app/...` on desktop, the bare path in Halflight Now. */
export function mediaPath(kind: MediaKind, id: string, pathname: string): string {
	const segment = `/${kind}s/${encodeURIComponent(id)}`;
	return isMobileRoute(pathname) ? segment : `/app${segment}`;
}

function here(): string {
	return typeof window === 'undefined' ? '/app' : window.location.pathname;
}

function absolute(path: string): string {
	return new URL(path, window.location.origin).href;
}

async function copyLink(path: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(absolute(path));
		contextMenu.notify(m.context_link_copied());
	} catch {
		contextMenu.notify(m.context_link_copy_failed());
	}
}

function shareAction(path: string, title: string): ContextAction[] {
	if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return [];
	return [
		{
			id: 'share',
			label: m.context_share(),
			icon: Share2,
			onSelect: () => navigator.share({ title, url: absolute(path) }).catch(() => {})
		}
	];
}

async function startRadio(track: TrackSummary): Promise<void> {
	try {
		const response = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/radio`);
		const tracks = response.ok
			? (((await response.json()) as { tracks?: TrackSummary[] }).tracks ?? [])
			: [];
		if (!tracks.length) throw new Error('Radio empty');
		player.play(tracks[0], tracks, m.player_radio_provenance({ title: track.title }));
	} catch {
		contextMenu.notify(m.player_radio_unavailable());
	}
}

const isCatalogue = (id: string) => /^\d{1,20}$/.test(id);

export interface TrackContext {
	contextTracks?: TrackSummary[];
	contextIndex?: number;
	provenance?: string;
	/** The surface's own play behaviour (e.g. search history), when it has one. */
	onPlayNow?: () => void;
	/** Leave out Play now where it would restart the current song. */
	showPlayNow?: boolean;
}

/** Navigation and sharing for one recording: album, artist, details, link. */
function trackDestinations(track: TrackSummary): ContextAction[] {
	const pathname = here();
	const actions: ContextAction[] = [];
	if (track.album?.id)
		actions.push({
			id: 'album',
			label: m.context_go_to_album(),
			icon: Disc3,
			onSelect: () => goto(mediaPath('album', track.album!.id, pathname))
		});
	const artist = track.artists.find((candidate) => candidate.id);
	if (artist)
		actions.push({
			id: 'artist',
			label: m.context_go_to_artist(),
			icon: UserRound,
			onSelect: () => goto(mediaPath('artist', artist.id, pathname))
		});
	if (isCatalogue(track.id)) {
		const path = mediaPath('track', track.id, pathname);
		actions.push(
			{ id: 'details', label: m.context_track_details(), icon: Info, onSelect: () => goto(path) },
			{ id: 'copy-link', label: m.context_copy_link(), icon: Link, onSelect: () => copyLink(path) },
			...shareAction(path, track.title)
		);
	}
	return actions;
}

function queueing(track: TrackSummary, provenance?: string): ContextAction[] {
	return [
		{
			id: 'play-next',
			label: m.track_action_play_next(),
			icon: ListStart,
			onSelect: () => {
				player.playNext(track, provenance);
				contextMenu.notify(m.context_added_next({ title: track.title }));
			}
		},
		{
			id: 'add-to-queue',
			label: m.track_action_add_to_queue(),
			icon: ListPlus,
			onSelect: () => {
				player.addToQueue(track, provenance);
				contextMenu.notify(m.context_added_queue({ title: track.title }));
			}
		}
	];
}

function collecting(track: TrackSummary): ContextAction[] {
	const actions: ContextAction[] = [
		{
			id: 'add-to-playlist',
			label: m.track_action_add_to_playlist(),
			icon: FolderPlus,
			onSelect: () => customPlaylists.promptAddToPlaylist(track)
		}
	];
	if (isCatalogue(track.id))
		actions.unshift({
			id: 'radio',
			label: m.track_action_start_radio(),
			icon: Radio,
			onSelect: () => startRadio(track)
		});
	return actions;
}

/** A song in a list: search results, albums, playlists, artists, library. */
export function trackActions(track: TrackSummary, context: TrackContext = {}): ContextAction[] {
	const play: ContextAction[] =
		context.showPlayNow === false
			? []
			: [
					{
						id: 'play-now',
						label: m.track_action_play_now(),
						icon: Play,
						onSelect: () => {
							if (context.onPlayNow) context.onPlayNow();
							else
								player.play(
									track,
									context.contextTracks ?? [track],
									context.provenance,
									context.contextIndex
								);
						}
					}
				];
	return [
		...play,
		...queueing(track, context.provenance),
		...collecting(track),
		...trackDestinations(track)
	];
}

/** One occurrence in the upcoming queue. */
export function queueEntryActions(entry: QueueEntry): ContextAction[] {
	const index = player.queue.findIndex((candidate) => candidate.entryId === entry.entryId);
	return [
		{
			id: 'play-from-queue',
			label: m.context_play_from_queue(),
			icon: Play,
			onSelect: () => player.playFromQueue(entry.entryId)
		},
		{
			id: 'move-up',
			label: m.player_move_up(),
			icon: ArrowUp,
			disabled: index <= 0,
			onSelect: () => player.moveQueueItem(entry.entryId, -1)
		},
		{
			id: 'move-down',
			label: m.player_move_down(),
			icon: ArrowDown,
			disabled: index === -1 || index >= player.queue.length - 1,
			onSelect: () => player.moveQueueItem(entry.entryId, 1)
		},
		{
			id: 'remove',
			label: m.player_remove_from_queue(),
			icon: Trash2,
			tone: 'danger',
			onSelect: () => player.removeFromQueue(entry.entryId)
		},
		...collecting(entry),
		...trackDestinations(entry)
	];
}

/** The song playing now: everything except restarting it. */
export function nowPlayingActions(track: TrackSummary): ContextAction[] {
	return [...collecting(track), ...trackDestinations(track)];
}

/** An album, artist or playlist card or link. */
export function mediaActions(
	kind: Exclude<MediaKind, 'track'>,
	id: string,
	title: string,
	href?: string
): ContextAction[] {
	const path = href ?? mediaPath(kind, id, here());
	return [
		{
			id: 'open',
			label: m.context_open(),
			icon: SquareArrowOutUpRight,
			onSelect: () => goto(path)
		},
		{
			id: 'open-new-tab',
			label: m.context_open_new_tab(),
			icon: ExternalLink,
			onSelect: () => {
				window.open(absolute(path), '_blank', 'noopener');
			}
		},
		{ id: 'copy-link', label: m.context_copy_link(), icon: Link, onSelect: () => copyLink(path) },
		...shareAction(path, title)
	];
}
