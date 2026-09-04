export interface PreloadedStreamData {
	audioQuality?: string;
	audioMode?: string;
	requestedQuality?: string | null;
	codecs?: string;
	fileExtension?: string;
	bitDepth?: number | null;
	sampleRate?: number | null;
	trackReplayGain?: number | null;
	isPreview?: boolean;
	requiresFullAuth?: boolean;
	fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 5;

export class StreamPreloader {
	private cache = new Map<string, PreloadedStreamData>();
	private inflight = new Map<string, Promise<PreloadedStreamData | null>>();

	/**
	 * Preload stream metadata for an upcoming track so next-track transition is instant.
	 */
	preload(trackId: string): void {
		if (!trackId || typeof fetch === 'undefined') return;

		// Check if already fresh in cache or already inflight
		const existing = this.cache.get(trackId);
		if (existing && Date.now() - existing.fetchedAt < CACHE_TTL_MS) return;
		if (this.inflight.has(trackId)) return;

		const promise = fetch(`/api/tracks/${encodeURIComponent(trackId)}/stream`)
			.then(async (res) => {
				if (!res.ok) return null;
				const data = (await res.json().catch(() => null)) as PreloadedStreamData | null;
				if (data) {
					data.fetchedAt = Date.now();
					this.setCache(trackId, data);
				}
				return data;
			})
			.catch(() => null)
			.finally(() => {
				this.inflight.delete(trackId);
			});

		this.inflight.set(trackId, promise);
	}

	/**
	 * Retrieve and consume cached metadata if available.
	 */
	consume(trackId: string): PreloadedStreamData | null {
		const cached = this.cache.get(trackId);
		if (!cached) return null;
		this.cache.delete(trackId);
		if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
		return cached;
	}

	/**
	 * Await inflight preload if in progress, or return null.
	 */
	async getOrAwait(trackId: string): Promise<PreloadedStreamData | null> {
		const consumed = this.consume(trackId);
		if (consumed) return consumed;

		const pending = this.inflight.get(trackId);
		if (pending) {
			const result = await pending;
			if (result) this.cache.delete(trackId);
			return result;
		}

		return null;
	}

	clear(): void {
		this.cache.clear();
		this.inflight.clear();
	}

	private setCache(trackId: string, data: PreloadedStreamData): void {
		if (this.cache.size >= MAX_ENTRIES) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey) this.cache.delete(oldestKey);
		}
		this.cache.set(trackId, data);
	}
}

export const streamPreloader = new StreamPreloader();
