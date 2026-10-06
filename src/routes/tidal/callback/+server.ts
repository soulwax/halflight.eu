import { redirect } from '@sveltejs/kit';
import { exchangeCode, writeRecord, TidalError } from '#lib/server/tidal';
import { clearOAuthCookie, readOAuthCookie, tidalReturnTo } from '../oauth-cookie';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || !event.locals.isListener) redirect(302, '/sign-in');

	const params = event.url.searchParams;
	const saved = readOAuthCookie(event.cookies);
	clearOAuthCookie(event.cookies);
	const returnTo = tidalReturnTo(saved?.returnTo);
	const fail = (reason: string): never =>
		redirect(303, `${returnTo}?error=${encodeURIComponent(reason)}`);

	const denied = params.get('error');
	if (denied) fail('authorization_denied');

	const code = params.get('code');
	const state = params.get('state');
	if (!code || !state) fail('missing_code');
	if (!saved) fail('expired_state');
	if (state !== saved!.state) fail('state_mismatch');
	if (saved!.userId !== event.locals.user.id) fail('account_mismatch');

	try {
		const record = await exchangeCode({ code: code!, verifier: saved!.verifier }, event.fetch);
		await writeRecord(record);
	} catch (err) {
		if (err instanceof TidalError) fail('connection_failed');
		throw err;
	}

	redirect(303, `${returnTo}?connected=1`);
};
