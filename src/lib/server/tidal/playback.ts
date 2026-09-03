import { getStreamingSettings, isStreamingQuality } from '#lib/server/streaming-settings';
import type { TrackAudioQuality } from './stream';

export type StreamingSettingsReader = typeof getStreamingSettings;

/**
 * Resolve an explicit API quality override or the owner's persisted preference.
 * Both `/stream` metadata and `/audio` bytes use this function so they cannot
 * disagree about the source format being requested.
 */
export async function getRequestedStreamQuality(
	url: URL,
	userId: string | undefined,
	readSettings: StreamingSettingsReader = getStreamingSettings
): Promise<TrackAudioQuality | undefined> {
	const explicit = url.searchParams.get('quality')?.toUpperCase();
	if (explicit && isStreamingQuality(explicit)) return explicit;
	return userId ? (await readSettings(userId)).preferredQuality : undefined;
}
