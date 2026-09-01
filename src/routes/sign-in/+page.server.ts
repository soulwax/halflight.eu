import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) redirect(302, '/app');
	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			await auth.api.signInEmail({
				body: { email, password, callbackURL: '/app' }
			});
		} catch (error) {
			if (error instanceof APIError) return fail(400, { signInFailed: true });
			return fail(500, { signInFailed: true });
		}

		redirect(302, '/app');
	},
	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString() ?? '';

		try {
			await auth.api.signUpEmail({
				body: { email, password, name, callbackURL: '/app' }
			});
		} catch (error) {
			if (error instanceof APIError) return fail(400, { signInFailed: true });
			return fail(500, { signInFailed: true });
		}

		redirect(302, '/app');
	},
	signInSocial: async () => {
		const result = await auth.api.signInSocial({
			body: { provider: 'github', callbackURL: '/app' }
		});

		if (result.url) redirect(302, result.url);
		return fail(400, { signInFailed: true });
	}
};
