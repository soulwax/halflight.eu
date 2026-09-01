import { redirect } from '@sveltejs/kit';
import { exchangeCode, writeRecord, TidalError } from '#lib/server/tidal';
import { clearOAuthCookie, readOAuthCookie } from '../oauth-cookie';
import type { RequestHandler } from './$types';

const fail = (reason: string) => redirect(303, `/tidal?error=${encodeURIComponent(reason)}`);

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');

	const params = event.url.searchParams;
	const saved = readOAuthCookie(event.cookies);
	clearOAuthCookie(event.cookies);

	const denied = params.get('error');
	if (denied) fail(params.get('error_description') || denied);

	const code = params.get('code');
	const state = params.get('state');
	if (!code || !state) fail('missing_code');
	if (!saved) fail('expired_state');
	if (state !== saved!.state) fail('state_mismatch');

	try {
		const record = await exchangeCode({ code: code!, verifier: saved!.verifier }, event.fetch);
		await writeRecord(record);
	} catch (err) {
		if (err instanceof TidalError) fail(err.message);
		throw err;
	}

	redirect(303, '/tidal?connected=1');
};
