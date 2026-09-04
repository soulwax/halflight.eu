import { dev } from '$app/env';
import { ADMIN_PASSWORD, ADMIN_USERNAME } from '$app/env/private';
import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth';
import { claimFirstAdministrator, getAdministratorEmail } from '#lib/server/admin';

const loopbackAddresses = new Set(['127.0.0.1', '::1']);

/**
 * Local screenshot/debug convenience. It intentionally does not exist outside
 * `vite dev`, accepts only loopback clients, and reads owner credentials only
 * on the server.
 */
export const GET: RequestHandler = async (event) => {
	if (!dev || !loopbackAddresses.has(event.getClientAddress())) error(404, 'Not found');
	if (event.locals.isAdministrator) redirect(302, '/app');

	const email = getAdministratorEmail();

	try {
		const result = await auth.api.signInEmail({
			body: { email, password: ADMIN_PASSWORD, callbackURL: '/app' }
		});
		if (!(await claimFirstAdministrator(result.user.id))) error(403, 'Forbidden');
	} catch (signInError) {
		if (!(signInError instanceof APIError)) error(500, 'Debug sign-in failed');

		try {
			const result = await auth.api.signUpEmail({
				body: { email, password: ADMIN_PASSWORD, name: ADMIN_USERNAME, callbackURL: '/app' }
			});
			if (!(await claimFirstAdministrator(result.user.id))) error(403, 'Forbidden');
		} catch {
			error(403, 'Debug sign-in failed');
		}
	}

	redirect(302, '/app');
};
