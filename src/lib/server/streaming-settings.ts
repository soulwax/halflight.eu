import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { streamingSettings } from '#lib/server/db/schema';
import { log } from '#lib/server/log';

export const STREAMING_QUALITIES = ['LOW', 'HIGH', 'LOSSLESS', 'HI_RES_LOSSLESS'] as const;
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

/**
 * Short-lived memo of the settings row. This is read on every app-shell render
 * *and* on every `/api/tracks/[id]/audio` request via `getRequestedStreamQuality`
 * — so once per seek — to answer a question that changes only when the owner
 * edits their preferences. The TTL is short enough that a change still lands
 * promptly, and {@link saveStreamingSettings} drops the entry immediately.
 */
const MEMO_TTL_MS = 30_000;
const memo = new Map<string, { settings: StreamingSettings; expiresAt: number }>();

/** Test seam: drop the memoised settings. */
export function __resetStreamingSettingsMemo(): void {
	memo.clear();
}

export async function getStreamingSettings(
	userId: string,
	store: StreamingSettingsStore = dbStreamingSettingsStore
): Promise<StreamingSettings> {
	const cached = memo.get(userId);
	if (cached && Date.now() < cached.expiresAt) return cached.settings;

	// A storage failure falls back to defaults rather than 500-ing the page.
	try {
		const settings = (await store.read(userId)) ?? DEFAULT_STREAMING_SETTINGS;
		memo.set(userId, { settings, expiresAt: Date.now() + MEMO_TTL_MS });
		return settings;
	} catch (err) {
		log.error('streaming-settings read failed, using defaults', { cause: err });
		// Deliberately not memoised: a transient outage must not pin defaults.
		return DEFAULT_STREAMING_SETTINGS;
	}
}

export async function saveStreamingSettings(
	userId: string,
	settings: StreamingSettings,
	store: StreamingSettingsStore = dbStreamingSettingsStore
): Promise<StreamingSettings> {
	memo.delete(userId);
	const written = await store.write(userId, settings);
	memo.set(userId, { settings: written, expiresAt: Date.now() + MEMO_TTL_MS });
	return written;
}
