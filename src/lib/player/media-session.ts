import { m } from '#lib/paraglide/messages.js';
import type { TrackSummary } from '#lib/tidal/models.js';
import { updateMediaMetadata as publishMetadata } from 'bragi-audio/player';

export {
	setupMediaSessionHandlers,
	toAbsoluteArtworkUrl,
	updatePlaybackState,
	updatePositionState,
	type MediaSessionHandlers
} from 'bragi-audio/player';

/** Publish lock-screen / Now Playing metadata, or clear it with `null`. */
export function updateMediaMetadata(track: TrackSummary | null): void {
	publishMetadata(track, { unknownArtist: m.player_unknown_artist() });
}
