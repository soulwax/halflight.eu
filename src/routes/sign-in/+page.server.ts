import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth';
import { safeProductReturn } from '#lib/mobile/site-entry';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	const returnTo = safeProductReturn(event.url.searchParams.get('returnTo')) ?? '/';
	if (event.locals.user && event.locals.isAdministrator) redirect(302, returnTo);
	return { returnTo };
};

export const actions: Actions = {
	signIn: async (event) => {
		const formData = await event.request.formData();
		const returnTo = safeProductReturn(formData.get('returnTo')) ?? '/';
		const email = formData.get('email')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		if (!email || !password) return fail(400, { signInFailed: true });

		try {
			await auth.api.signInEmail({
				body: { email, password, callbackURL: returnTo }
			});
		} catch {
			return fail(400, { signInFailed: true });
		}

		redirect(302, returnTo);
	},
	signUp: async (event) => {
		const formData = await event.request.formData();
		const returnTo = safeProductReturn(formData.get('returnTo')) ?? '/';
		const name = formData.get('name')?.toString().trim() ?? '';
		const email = formData.get('email')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		if (!name || !email || !password) return fail(400, { signUpFailed: true });

		try {
			await auth.api.signUpEmail({ body: { name, email, password, callbackURL: returnTo } });
			return { verificationSent: true };
		} catch (error) {
			return fail(error instanceof APIError ? 400 : 500, { signUpFailed: true });
		}
	},
	signInSocial: async (event) => {
		const formData = await event.request.formData();
		const returnTo = safeProductReturn(formData.get('returnTo')) ?? '/';
		let authorizeUrl: string | undefined;
		try {
			const result = await auth.api.signInSocial({
				body: { provider: 'github', callbackURL: returnTo, errorCallbackURL: '/sign-in' }
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
