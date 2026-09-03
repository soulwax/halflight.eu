import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { streamingSettings } from '#lib/server/db/schema';

export const STREAMING_QUALITIES = ['LOW', 'HIGH', 'LOSSLESS'] as const;
export type StreamingQuality = (typeof STREAMING_QUALITIES)[number];

export interface StreamingSettings {
	preferredQuality: StreamingQuality;
	volume: number;
	loudnessNormalization: boolean;
}

export const DEFAULT_STREAMING_SETTINGS: StreamingSettings = {
	preferredQuality: 'HIGH',
	volume: 100,
	loudnessNormalization: true
};

type StreamingSettingsRecord = StreamingSettings;

export interface StreamingSettingsStore {
	read(userId: string): Promise<StreamingSettingsRecord | null>;
	write(userId: string, settings: StreamingSettings): Promise<StreamingSettingsRecord>;
}

export const dbStreamingSettingsStore: StreamingSettingsStore = {
	async read(userId) {
		const rows = await db
			.select({
				preferredQuality: streamingSettings.preferredQuality,
				volume: streamingSettings.volume,
				loudnessNormalization: streamingSettings.loudnessNormalization
			})
			.from(streamingSettings)
			.where(eq(streamingSettings.userId, userId))
			.limit(1);
		return rows[0] ? parseStreamingSettings(rows[0]) : null;
	},
	async write(userId, settings) {
		const rows = await db
			.insert(streamingSettings)
			.values({ userId, ...settings, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: streamingSettings.userId,
				set: { ...settings, updatedAt: new Date() }
			})
			.returning({
				preferredQuality: streamingSettings.preferredQuality,
				volume: streamingSettings.volume,
				loudnessNormalization: streamingSettings.loudnessNormalization
			});
		return parseStreamingSettings(rows[0]);
	}
};

export function isStreamingQuality(value: string): value is StreamingQuality {
	return (STREAMING_QUALITIES as readonly string[]).includes(value);
}

export function parseStreamingSettings(value: {
	preferredQuality: string;
	volume: number;
	loudnessNormalization: boolean;
}): StreamingSettings {
	return {
		preferredQuality: isStreamingQuality(value.preferredQuality)
			? value.preferredQuality
			: DEFAULT_STREAMING_SETTINGS.preferredQuality,
		volume: Math.max(0, Math.min(100, Math.round(value.volume))),
		loudnessNormalization: Boolean(value.loudnessNormalization)
	};
}

export function parseStreamingSettingsInput(input: {
	preferredQuality?: string | null;
	volume?: string | number | null;
	loudnessNormalization?: string | boolean | null;
}): StreamingSettings | null {
	if (!input.preferredQuality || !isStreamingQuality(input.preferredQuality)) return null;
	const volume = Number(input.volume);
	if (!Number.isInteger(volume) || volume < 0 || volume > 100) return null;

	return {
		preferredQuality: input.preferredQuality,
		volume,
		loudnessNormalization:
			input.loudnessNormalization === true ||
			input.loudnessNormalization === 'true' ||
			input.loudnessNormalization === 'on'
	};
}

export async function getStreamingSettings(
	userId: string,
	store: StreamingSettingsStore = dbStreamingSettingsStore
): Promise<StreamingSettings> {
	// Loaded on every app-shell render — a storage failure falls back to
	// defaults rather than 500-ing the page.
	try {
		return (await store.read(userId)) ?? DEFAULT_STREAMING_SETTINGS;
	} catch (err) {
		console.error(`[streaming-settings] read failed, using defaults: ${err}`);
		return DEFAULT_STREAMING_SETTINGS;
	}
}

export function saveStreamingSettings(
	userId: string,
	settings: StreamingSettings,
	store: StreamingSettingsStore = dbStreamingSettingsStore
): Promise<StreamingSettings> {
	return store.write(userId, settings);
}
