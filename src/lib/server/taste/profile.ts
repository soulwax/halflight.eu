import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db';
import { tasteProfile } from '#lib/server/db/schema';
import type { TasteSignals, TasteSignalSource } from './signals';

export const TASTE_PROFILE_VERSION = 1;

export interface GenerationDefaults {
	familiarity: number;
}

export interface TasteProfile {
	version: typeof TASTE_PROFILE_VERSION;
	artists: Record<string, number>;
	eras: Record<string, number>;
	exclusions: { artists: string[]; eras: number[] };
	overrides: { artists: Record<string, 'pinned' | 'dampened'> };
	knobDefaults: GenerationDefaults;
	confidence: { artists: number; eras: number };
	updatedAt: string;
}

export interface TasteProfileStore {
	read(userId: string): Promise<TasteProfile | null>;
	write(userId: string, profile: TasteProfile): Promise<TasteProfile>;
	delete(userId: string): Promise<void>;
}

const DEFAULT_KNOB_DEFAULTS: GenerationDefaults = { familiarity: 50 };
const SOURCE_WEIGHT: Record<TasteSignalSource, number> = {
	playlist: 1,
	followed_artist: 4,
	saved_track: 1.5,
	saved_album: 2,
	session: 2
};

function clamp(value: number, min = 0, max = 1): number {
	return Math.min(max, Math.max(min, value));
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function validId(value: unknown, maxLength = 128): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function parseWeights(
	value: unknown,
	keyValidator: (key: string) => boolean
): Record<string, number> {
	const source = asRecord(value);
	if (!source) return {};
	const weights: Record<string, number> = {};
	for (const [key, weight] of Object.entries(source)) {
		if (keyValidator(key) && typeof weight === 'number' && Number.isFinite(weight) && weight > 0) {
			weights[key] = clamp(weight);
		}
	}
	return weights;
}

function parseEra(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value >= 1880 && value <= 2100
		? value
		: null;
}

function parseProfile(value: unknown): TasteProfile | null {
	const raw = asRecord(value);
	if (!raw || raw.version !== TASTE_PROFILE_VERSION || typeof raw.updatedAt !== 'string')
		return null;
	const exclusions = asRecord(raw.exclusions);
	const overrides = asRecord(raw.overrides);
	const artistOverrides = asRecord(overrides?.artists);
	const knobDefaults = asRecord(raw.knobDefaults);
	const confidence = asRecord(raw.confidence);

	return {
		version: TASTE_PROFILE_VERSION,
		artists: parseWeights(raw.artists, (id) => validId(id)),
		eras: parseWeights(raw.eras, (era) => parseEra(Number(era)) !== null),
		exclusions: {
			artists: [
				...new Set((Array.isArray(exclusions?.artists) ? exclusions.artists : []).filter(validId))
			],
			eras: [
				...new Set(
					(Array.isArray(exclusions?.eras) ? exclusions.eras : [])
						.map(parseEra)
						.filter((era): era is number => era !== null)
				)
			]
		},
		overrides: {
			artists: Object.fromEntries(
				Object.entries(artistOverrides ?? {}).filter(
					([id, mode]) => validId(id) && (mode === 'pinned' || mode === 'dampened')
				)
			) as Record<string, 'pinned' | 'dampened'>
		},
		knobDefaults: {
			familiarity:
				typeof knobDefaults?.familiarity === 'number'
					? clamp(knobDefaults.familiarity, 0, 100)
					: DEFAULT_KNOB_DEFAULTS.familiarity
		},
		confidence: {
			artists: typeof confidence?.artists === 'number' ? clamp(confidence.artists) : 0,
			eras: typeof confidence?.eras === 'number' ? clamp(confidence.eras) : 0
		},
		updatedAt: raw.updatedAt
	};
}

export function emptyTasteProfile(now = new Date()): TasteProfile {
	return {
		version: TASTE_PROFILE_VERSION,
		artists: {},
		eras: {},
		exclusions: { artists: [], eras: [] },
		overrides: { artists: {} },
		knobDefaults: { ...DEFAULT_KNOB_DEFAULTS },
		confidence: { artists: 0, eras: 0 },
		updatedAt: now.toISOString()
	};
}

/** A recent event is worth roughly twice an event two years old. */
export function recencyMultiplier(observedAt: string | undefined, now = new Date()): number {
	if (!observedAt) return 1;
	const timestamp = Date.parse(observedAt);
	if (!Number.isFinite(timestamp)) return 1;
	const ageDays = Math.max(0, (now.getTime() - timestamp) / (24 * 60 * 60 * 1000));
	return 1 + Math.exp(-ageDays / 90);
}

function normalise(weights: Record<string, number>): Record<string, number> {
	const max = Math.max(0, ...Object.values(weights));
	if (!max) return {};
	return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / max]));
}

function confidenceFor(weights: Record<string, number>, anchorCount: number): number {
	if (anchorCount === 0) return 0;
	const breadth = 1 - Math.exp(-Object.keys(weights).length / 5);
	const evidence = 1 - Math.exp(-anchorCount / 20);
	return Number((breadth * 0.6 + evidence * 0.4).toFixed(3));
}

function weightedSignals<T extends { source: TasteSignalSource; observedAt?: string }>(
	signals: T[],
	key: (signal: T) => string
): Record<string, number> {
	const bySource = new Map<TasteSignalSource, Record<string, number>>();
	for (const signal of signals) {
		const source = bySource.get(signal.source) ?? {};
		const id = key(signal);
		source[id] = (source[id] ?? 0) + recencyMultiplier(signal.observedAt);
		bySource.set(signal.source, source);
	}

	const combined: Record<string, number> = {};
	for (const [source, weights] of bySource) {
		for (const [id, weight] of Object.entries(normalise(weights))) {
			combined[id] = (combined[id] ?? 0) + weight * SOURCE_WEIGHT[source];
		}
	}
	return normalise(combined);
}

/**
 * Rebuilds derived weights from fresh signals while preserving explicit owner
 * choices. Inputs are not retained after this function returns.
 */
export function buildTasteProfile(
	signals: TasteSignals,
	previous: TasteProfile = emptyTasteProfile(),
	now = new Date()
): TasteProfile {
	const artists = weightedSignals(signals.artistSignals, (signal) => signal.artistId);
	const eras = weightedSignals(signals.eraSignals, (signal) => String(signal.decade));

	for (const artistId of previous.exclusions.artists) delete artists[artistId];
	for (const era of previous.exclusions.eras) delete eras[String(era)];
	for (const [artistId, mode] of Object.entries(previous.overrides.artists)) {
		if (previous.exclusions.artists.includes(artistId)) continue;
		artists[artistId] = mode === 'pinned' ? 1 : (artists[artistId] ?? 0) * 0.25;
	}

	return {
		version: TASTE_PROFILE_VERSION,
		artists: normalise(artists),
		eras: normalise(eras),
		exclusions: {
			artists: [...previous.exclusions.artists],
			eras: [...previous.exclusions.eras]
		},
		overrides: { artists: { ...previous.overrides.artists } },
		knobDefaults: { ...previous.knobDefaults },
		confidence: {
			artists: confidenceFor(artists, signals.artistSignals.length),
			eras: confidenceFor(eras, signals.eraSignals.length)
		},
		updatedAt: now.toISOString()
	};
}

export const dbTasteProfileStore: TasteProfileStore = {
	async read(userId) {
		const rows = await db
			.select({ data: tasteProfile.data })
			.from(tasteProfile)
			.where(eq(tasteProfile.userId, userId))
			.limit(1);
		return rows[0] ? parseProfile(rows[0].data) : null;
	},
	async write(userId, profile) {
		const parsed = parseProfile(profile);
		if (!parsed) throw new Error('Cannot persist an invalid taste profile.');
		const rows = await db
			.insert(tasteProfile)
			.values({ userId, data: parsed, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: tasteProfile.userId,
				set: { data: parsed, updatedAt: new Date() }
			})
			.returning({ data: tasteProfile.data });
		const persisted = parseProfile(rows[0]?.data);
		if (!persisted) throw new Error('Persisted taste profile is invalid.');
		return persisted;
	},
	async delete(userId) {
		await db.delete(tasteProfile).where(eq(tasteProfile.userId, userId));
	}
};

export async function getTasteProfile(
	userId: string,
	store: TasteProfileStore = dbTasteProfileStore
): Promise<TasteProfile> {
	return (await store.read(userId)) ?? emptyTasteProfile();
}

export async function rebuildTasteProfile(
	userId: string,
	signals: TasteSignals,
	store: TasteProfileStore = dbTasteProfileStore,
	now = new Date()
): Promise<TasteProfile> {
	const previous = (await store.read(userId)) ?? emptyTasteProfile(now);
	return store.write(userId, buildTasteProfile(signals, previous, now));
}
