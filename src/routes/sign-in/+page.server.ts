import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth';
import {
	claimFirstAdministrator,
	getAdministratorEmail,
	hasAdministratorCredentials
} from '#lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (event.locals.isAdministrator) redirect(302, '/app');
	return {};
};

export const actions: Actions = {
	signInAdministrator: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		if (!hasAdministratorCredentials(username, password)) return fail(400, { signInFailed: true });

		const email = getAdministratorEmail();

		try {
			const result = await auth.api.signInEmail({
				body: { email, password, callbackURL: '/app' }
			});
			if (!(await claimFirstAdministrator(result.user.id)))
				return fail(403, { signInFailed: true });
		} catch (error) {
			if (!(error instanceof APIError)) return fail(500, { signInFailed: true });

			try {
				const result = await auth.api.signUpEmail({
					body: { email, password, name: username, callbackURL: '/app' }
				});
				if (!(await claimFirstAdministrator(result.user.id)))
					return fail(403, { signInFailed: true });
			} catch {
				return fail(400, { signInFailed: true });
			}
		}

		redirect(302, '/app');
	},
	signInSocial: async () => {
		let authorizeUrl: string | undefined;
		try {
			const result = await auth.api.signInSocial({
				body: { provider: 'github', callbackURL: '/app', errorCallbackURL: '/sign-in' }
			});
			authorizeUrl = result.url;
		} catch {
			return fail(400, { signInFailed: true });
		}

		// `redirect` throws — it must live outside the try/catch above, or it is
		// swallowed and wrongly reported as a sign-in failure. SvelteKit 3 also
		// requires opting in to the external GitHub origin.
		if (!authorizeUrl) return fail(400, { signInFailed: true });
		redirect(302, authorizeUrl, { external: ['https://github.com'] });
	}
};
