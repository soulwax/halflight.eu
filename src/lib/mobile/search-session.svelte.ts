import type { SearchResultGroups } from '#lib/tidal/models';

export const MOBILE_SEARCH_SESSION = Symbol('mobile-search-session');

/** Ephemeral, layout-scoped results: kept across mobile route changes, never persisted. */
export class MobileSearchSession {
	lastQuery = $state('');
	lastResults = $state<SearchResultGroups | null>(null);

	remember(query: string, results: SearchResultGroups): void {
		const normalizedQuery = query.trim();
		if (!normalizedQuery) return;
		this.lastQuery = normalizedQuery;
		this.lastResults = results;
	}
}
