import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models.js';
import { updateMediaMetadata as publishMetadata } from 'syn.js/player';

export {
	setupMediaSessionHandlers,
	toAbsoluteArtworkUrl,
	updatePlaybackState,
	updatePositionState,
	type MediaSessionHandlers
} from 'syn.js/player';

/** Publish lock-screen / Now Playing metadata, or clear it with `null`. */
export function updateMediaMetadata(track: TrackSummary | null): void {
	publishMetadata(track, { unknownArtist: m.player_unknown_artist() });
}
