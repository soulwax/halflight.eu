import type { RequestEvent } from '@sveltejs/kit';
import { getConnectionStatus } from '#lib/server/tidal';
import { getPlaybackState, type PlaybackState } from '#lib/server/playback-state';
import { getStreamingSettings, type StreamingSettings } from '#lib/server/streaming-settings';

export interface SessionShellData {
	connection: { connected: boolean; configured: boolean; hasPlayback?: boolean };
	streamingSettings: StreamingSettings;
	playbackState: PlaybackState;
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

	const [connection, streamingSettings, playbackState] = await Promise.all([
		getConnectionStatus(),
		getStreamingSettings(userId),
		getPlaybackState(userId)
	]);

	return {
		connection: {
			connected: connection.connected,
			configured: connection.configured,
			hasPlayback: connection.hasPlayback
		},
		streamingSettings,
		playbackState
	};
}
