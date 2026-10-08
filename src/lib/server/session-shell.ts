import type { RequestEvent } from '@sveltejs/kit';
import { getConnectionStatus } from '#lib/server/tidal';
import { getPlaybackState, type PlaybackState } from '#lib/server/playback-state';
import { getStreamingSettings, type StreamingSettings } from '#lib/server/streaming-settings';
import {
	getListeningPreferences,
	type ListeningPreferences
} from '#lib/server/listening-preferences';
import { getUnplayableTrackIds } from '#lib/server/tidal/track-playability';
import { ensureTidalIdentityLinked } from '#lib/server/tidal/identity';

export interface SessionShellData {
	connection: { connected: boolean; configured: boolean; hasPlayback?: boolean };
	streamingSettings: StreamingSettings;
	listeningPreferences: ListeningPreferences;
	playbackState: PlaybackState;
	knownUnavailableIds: string[];
}

/**
 * The data every authenticated shell (desktop `/app` and the mobile `(mobile)`
 * route group) needs to mount the player: TIDAL connection health, the
 * owner's streaming preferences and the resumable queue/position. Shared so
 * both sites read it identically instead of hand-rolling the same `Promise.all`
 * twice — see MASTERPLAN.md "share domain logic, never whole layouts".
 */
export async function loadSessionShellData(event: RequestEvent): Promise<SessionShellData> {
	const userId = event.locals.user?.id;
	if (!userId) throw new Error('loadSessionShellData requires an authenticated request.');

	// Off the render path: memoised per user, and it never throws.
	void ensureTidalIdentityLinked(userId);

	const [connection, streamingSettings, listeningPreferences, playbackState] = await Promise.all([
		getConnectionStatus(),
		getStreamingSettings(userId),
		getListeningPreferences(userId),
		getPlaybackState(userId)
	]);
	const knownUnavailableIds = [
		...(playbackState.currentTrack ? [playbackState.currentTrack.id] : []),
		...playbackState.queue.slice(0, 8).map((track) => track.id)
	];
	const unavailable = await getUnplayableTrackIds(knownUnavailableIds);

	return {
		connection: {
			connected: connection.connected,
			configured: connection.configured,
			hasPlayback: connection.hasPlayback
		},
		streamingSettings,
		listeningPreferences,
		playbackState,
		knownUnavailableIds: [...unavailable]
	};
}
