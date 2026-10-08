import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth';
import { isMobileRoute } from '#lib/mobile/routes';
import { safeProductReturn } from '#lib/mobile/site-entry';
import { isTidalSignInAvailable, TIDAL_SIGN_IN_PROVIDER } from '#lib/server/tidal/sign-in';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	const returnTo = safeProductReturn(event.url.searchParams.get('returnTo')) ?? '/';
	if (event.locals.user && event.locals.isListener) redirect(302, returnTo);
	return {
		returnTo,
		tidalSignIn: isTidalSignInAvailable(),
		oauthError: oauthErrorKind(event.url.searchParams.get('error'))
	};
};

/** Better Auth sends OAuth failures back here as `?error=<code>`. */
function oauthErrorKind(code: string | null): 'cancelled' | 'account_exists' | 'failed' | null {
	if (!code) return null;
	if (code === 'access_denied') return 'cancelled';
	if (code === 'account_not_linked') return 'account_exists';
	return 'failed';
}

/** Each social provider's consent origin, which SvelteKit 3 must allow explicitly. */
const SOCIAL_ORIGINS = {
	[TIDAL_SIGN_IN_PROVIDER]: 'https://login.tidal.com',
	github: 'https://github.com'
} as const;

type SocialProvider = keyof typeof SOCIAL_ORIGINS;

function isSocialProvider(value: unknown): value is SocialProvider {
	return typeof value === 'string' && Object.hasOwn(SOCIAL_ORIGINS, value);
}

/**
 * A brand-new TIDAL listener has browse access but not full playback yet, so
 * land them on the one remaining step (TIDAL Link) instead of the app shell.
 * From the site root the shell is only chosen client-side, so the root page
 * carries the `welcome` flag on to the right settings page.
 */
function newTidalListenerLanding(returnTo: string): string {
	const path = new URL(returnTo, 'https://halflight.invalid').pathname;
	if (path === '/') return '/?welcome=1';
	return isMobileRoute(path) ? '/settings' : '/app/settings/tidal?welcome=1';
}

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
		const provider = formData.get('provider') ?? 'github';
		if (!isSocialProvider(provider)) return fail(400, { signInFailed: true });
		if (provider === TIDAL_SIGN_IN_PROVIDER && !isTidalSignInAvailable())
			return fail(400, { signInFailed: true });

		let authorizeUrl: string | undefined;
		try {
			const result = await auth.api.signInSocial({
				body: {
					provider,
					callbackURL: returnTo,
					newUserCallbackURL:
						provider === TIDAL_SIGN_IN_PROVIDER ? newTidalListenerLanding(returnTo) : undefined,
					errorCallbackURL: `/sign-in?returnTo=${encodeURIComponent(returnTo)}`
				}
			});
			authorizeUrl = result.url;
		} catch {
			return fail(400, { signInFailed: true });
		}

		// `redirect` throws — it must live outside the try/catch above, or it is
		// swallowed and wrongly reported as a sign-in failure. SvelteKit 3 also
		// requires opting in to the provider's external origin.
		if (!authorizeUrl) return fail(400, { signInFailed: true });
		redirect(302, authorizeUrl, { external: [SOCIAL_ORIGINS[provider]] });
	}
};
