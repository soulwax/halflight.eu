/**
 * The failure states a TIDAL-backed page can render. `StateCard.svelte` turns
 * each into an actionable message; the `[id]` route loads produce them via
 * `loadTidalPage` (`#lib/server/tidal/load`).
 */
export type TidalPageState =
	'invalid_id' | 'not_connected' | 'authorization_expired' | 'not_found' | 'unavailable';
