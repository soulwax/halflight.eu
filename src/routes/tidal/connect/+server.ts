import { error, redirect } from '@sveltejs/kit';
import {
	buildAuthorizeUrl,
	createPkcePair,
	createState,
	getTidalConfig,
	TidalConfigError
} from '#lib/server/tidal';
import { OAUTH_COOKIE, oauthCookieOptions } from '../oauth-cookie';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');

	try {
		getTidalConfig();
	} catch (err) {
		if (err instanceof TidalConfigError) error(500, err.message);
		throw err;
	}

	const state = createState();
	const { verifier, challenge } = createPkcePair();

	event.cookies.set(
		OAUTH_COOKIE,
		JSON.stringify({ state, verifier }),
		oauthCookieOptions(event.url)
	);

	redirect(302, buildAuthorizeUrl({ state, challenge }));
};
