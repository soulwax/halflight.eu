import type { RequestEvent } from '@sveltejs/kit';
import { getConnectionStatus } from '#lib/server/tidal';
import { getPlaybackState, type PlaybackState } from '#lib/server/playback-state';
import { getStreamingSettings, type StreamingSettings } from '#lib/server/streaming-settings';
import { getUserSettings } from '#lib/server/user-settings';
import type { DarkTheme, VisualStyle } from '#lib/theme/types';

export interface SessionShellData {
	connection: { connected: boolean; configured: boolean };
	streamingSettings: StreamingSettings;
	playbackState: PlaybackState;
	theme: DarkTheme;
	visualStyle: VisualStyle;
}

/**
 * The data every authenticated shell (desktop `/app` and the mobile `(mobile)`
 * route group) needs to mount the player: TIDAL connection health, the
 * owner's streaming preferences, the resumable queue/position, and the active
 * theme. Shared so both sites read it identically instead of hand-rolling the
 * same `Promise.all` twice — see MASTERPLAN.md "share domain logic, never
 * whole layouts".
 */
export async function loadSessionShellData(event: RequestEvent): Promise<SessionShellData> {
	const userId = event.locals.user?.id;
	if (!userId) throw new Error('loadSessionShellData requires an authenticated request.');

	const [connection, streamingSettings, playbackState, userSettings] = await Promise.all([
		getConnectionStatus(),
		getStreamingSettings(userId),
		getPlaybackState(userId),
		getUserSettings(userId)
	]);

	return {
		connection: {
			connected: connection.connected,
			configured: connection.configured
		},
		streamingSettings,
		playbackState,
		theme: userSettings.theme,
		visualStyle: userSettings.visualStyle
	};
}
