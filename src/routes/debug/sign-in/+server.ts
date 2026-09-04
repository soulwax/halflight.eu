import { dev } from '$app/env';
import { ADMIN_PASSWORD, ADMIN_USERNAME } from '$app/env/private';
import { eq } from 'drizzle-orm';
import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth';
import { claimFirstAdministrator, getAdministratorEmail } from '#lib/server/admin';
import { db } from '#lib/server/db';
import { user } from '#lib/server/db/schema';

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
	const signIn = () =>
		auth.api.signInEmail({
			body: { email, password: ADMIN_PASSWORD, callbackURL: '/app' }
		});

	let result: Awaited<ReturnType<typeof signIn>>;

	try {
		result = await signIn();
	} catch (signInError) {
		if (!(signInError instanceof APIError)) error(500, 'Debug sign-in failed');

		const existingUser = await db.query.user.findFirst({
			columns: { id: true },
			where: eq(user.email, email)
		});

		if (existingUser) {
			// This route is restricted to loopback during `vite dev`; marking its
			// deterministic, non-deliverable address verified avoids requiring SMTP
			// just to take a local screenshot.
			await db.update(user).set({ emailVerified: true }).where(eq(user.id, existingUser.id));
		} else {
			const created = await auth.api.signUpEmail({
				body: { email, password: ADMIN_PASSWORD, name: ADMIN_USERNAME, callbackURL: '/app' }
			});
			await db.update(user).set({ emailVerified: true }).where(eq(user.id, created.user.id));
		}

		try {
			result = await signIn();
		} catch {
			error(403, 'Debug sign-in failed');
		}
	}

	if (!(await claimFirstAdministrator(result.user.id))) error(403, 'Forbidden');

	redirect(302, '/app');
};
