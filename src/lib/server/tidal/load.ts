import { redirect, type RequestEvent } from '@sveltejs/kit';
import { TidalApiError, TidalAuthError, TidalNotConnectedError } from './errors';
import type { TidalRequestContext } from './client';
import type { TidalPageState } from '#lib/tidal/page-state';

export type { TidalPageState };

export const MAX_TIDAL_ID_LENGTH = 160;

interface Connection {
	connected: boolean;
	configured: boolean;
}

export interface TidalPageLoader<Fail, Ok> {
	/** Usually the module's `getConnectionStatus`; injectable for tests. */
	getConnectionStatus: () => Promise<Connection>;
	/** Builds the page's disconnected/error payload. */
	failure: (state: TidalPageState, configured: boolean, id?: string) => Fail;
	/** Fetches and normalises the resource once the connection is known good. */
	run: (ctx: TidalRequestContext, id: string, configured: boolean) => Promise<Ok>;
}

/**
 * The shared shape of every `/app/{albums,artists,tracks,playlists}/[id]`
 * `+page.server.ts` load: guard the session, validate the id, confirm a live
 * TIDAL connection, then run the page-specific fetch — mapping the known TIDAL
 * errors to a `TidalPageState` so the page renders a `StateCard` instead of a 500.
 */
export async function loadTidalPage<Fail, Ok>(
	event: Pick<RequestEvent, 'locals' | 'params' | 'fetch' | 'cookies'>,
	{ getConnectionStatus, failure, run }: TidalPageLoader<Fail, Ok>
): Promise<Fail | Ok> {
	if (!event.locals.user) redirect(302, '/sign-in');

	const id = event.params.id;
	if (!id || id.length > MAX_TIDAL_ID_LENGTH) return failure('invalid_id', true);

	let connection: Connection;
	try {
		connection = await getConnectionStatus();
	} catch {
		return failure('unavailable', true, id);
	}

	if (!connection.connected) return failure('not_connected', connection.configured, id);

	try {
		return await run({ fetch: event.fetch, cookies: event.cookies }, id, connection.configured);
	} catch (error) {
		if (error instanceof TidalNotConnectedError)
			return failure('not_connected', connection.configured, id);
		if (error instanceof TidalAuthError)
			return failure('authorization_expired', connection.configured, id);
		if (error instanceof TidalApiError && error.status === 404)
			return failure('not_found', connection.configured, id);
		return failure('unavailable', connection.configured, id);
	}
}
