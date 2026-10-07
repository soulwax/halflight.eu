import type { TrackSummary } from '#lib/tidal/models';

export interface SearchHistoryEntry {
	track: TrackSummary;
	query: string;
	playedAt: number;
}
const LIMIT = 20;

/** Kept separately from result caches; only verified playback enters this store. */
export class SearchHistory {
	entries = $state<SearchHistoryEntry[]>([]);
	private owner: string | null = null;
	private selection: { id: string; query: string; at: number } | null = null;
	get ownerId(): string | null {
		return this.owner;
	}
	select(track: TrackSummary, query: string): void {
		this.selection = { id: track.id, query, at: Date.now() };
	}
	takeSelection(id: string): string | null {
		const selected = this.selection;
		this.selection = null;
		return selected?.id === id && Date.now() - selected.at < 10 * 60_000 ? selected.query : null;
	}
	private get key(): string | null {
		return this.owner ? `halflight:played-search:v1:${this.owner}` : null;
	}
	setOwner(owner: string | null): void {
		if (this.owner === owner) return;
		this.owner = owner;
		this.selection = null;
		this.entries = [];
		if (!this.key || typeof localStorage === 'undefined') return;
		try {
			const stored: unknown = JSON.parse(localStorage.getItem(this.key) ?? '[]');
			if (Array.isArray(stored)) {
				this.entries = dedupeEntries(stored.filter(validEntry)).slice(0, LIMIT);
				this.save();
			}
		} catch {
			/* A disabled browser store cannot prevent playback. */
		}
	}
	remember(track: TrackSummary, query: string): void {
		if (!query.trim() || !track.title.trim()) return;
		this.entries = [
			{
				track: { ...track, artists: [...track.artists] },
				query: query.trim(),
				playedAt: Date.now()
			},
			...this.entries.filter((entry) => !sameRecording(entry.track, track))
		].slice(0, LIMIT);
		this.save();
	}
	remove(id: string): void {
		this.entries = this.entries.filter(({ track }) => track.id !== id);
		this.save();
	}
	clear(): void {
		this.entries = [];
		this.save();
	}
	private save(): void {
		if (!this.key || typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(this.key, JSON.stringify(this.entries));
		} catch {
			/* Device storage is optional. */
		}
	}
}
function normalizedIsrc(track: TrackSummary): string | null {
	const value =
		typeof track.isrc === 'string' ? track.isrc.replace(/[^a-z0-9]/gi, '').toUpperCase() : '';
	return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(value) ? value : null;
}
function sameRecording(a: TrackSummary, b: TrackSummary): boolean {
	if (a.id === b.id) return true;
	const isrc = normalizedIsrc(a);
	return isrc !== null && isrc === normalizedIsrc(b);
}
function dedupeEntries(entries: SearchHistoryEntry[]): SearchHistoryEntry[] {
	const unique: SearchHistoryEntry[] = [];
	for (const entry of [...entries].sort((a, b) => b.playedAt - a.playedAt)) {
		if (!unique.some((existing) => sameRecording(existing.track, entry.track))) unique.push(entry);
	}
	return unique;
}
function validEntry(value: unknown): value is SearchHistoryEntry {
	if (!value || typeof value !== 'object') return false;
	const entry = value as SearchHistoryEntry;
	return (
		typeof entry.query === 'string' &&
		typeof entry.playedAt === 'number' &&
		Number.isFinite(entry.playedAt) &&
		entry.track?.kind === 'track' &&
		typeof entry.track.id === 'string' &&
		typeof entry.track.title === 'string' &&
		Array.isArray(entry.track.artists) &&
		entry.track.artists.every(
			(artist) => typeof artist?.name === 'string' && typeof artist.id === 'string'
		)
	);
}
export const searchHistory = new SearchHistory();
