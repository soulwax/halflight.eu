import { redirect } from '@sveltejs/kit';
import {
	buildAuthorizeUrl,
	createPkcePair,
	createState,
	getTidalConfig,
	TIDAL_AUTHORIZE_URL,
	TidalConfigError
} from '#lib/server/tidal';
import { OAUTH_COOKIE, oauthCookieOptions } from '../oauth-cookie';
import type { RequestHandler } from './$types';

const TIDAL_LOGIN_ORIGIN = new URL(TIDAL_AUTHORIZE_URL).origin;

export const GET: RequestHandler = (event) => {
	if (!event.locals.user || !event.locals.isAdministrator) redirect(302, '/sign-in');

	let configured = true;
	try {
		getTidalConfig();
	} catch (err) {
		if (!(err instanceof TidalConfigError)) throw err;
		configured = false;
	}

	// Missing/invalid TIDAL env: send the operator to the settings page, which
	// explains exactly what is not configured, instead of a bare 500.
	if (!configured) redirect(303, '/app/settings/tidal');

	const state = createState();
	const { verifier, challenge } = createPkcePair();

	event.cookies.set(
		OAUTH_COOKIE,
		JSON.stringify({ state, verifier }),
		oauthCookieOptions(event.url)
	);

	redirect(302, buildAuthorizeUrl({ state, challenge }), { external: [TIDAL_LOGIN_ORIGIN] });
};
