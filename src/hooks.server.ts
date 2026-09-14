import { getTextDirection } from '#lib/paraglide/runtime';
import { paraglideMiddleware } from '#lib/paraglide/server';
import { getUserStatus, isAdministrator, isFirstAdministrator } from '#lib/server/admin';
import { auth } from '#lib/server/auth';
import { DEFAULT_THEME, getThemeSettings, isTheme } from '#lib/server/theme-settings';
import { building } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';

/**
 * Fast, synchronous SSR hint so `<html data-theme>` is correct on the very
 * first byte — no flash of the wrong palette while a DB read is pending. Not
 * HttpOnly: it holds only a display preference, never anything sensitive, and
 * the settings pages update it client-side too for an instant switch.
 */
const THEME_COOKIE = 'hf-theme';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		// SvelteKit 3 types `event.request` as readonly; paraglide returns a
		// request with a de-localised URL that downstream handlers should see.
		(event as { request: Request }).request = request;

		return resolve(event, {
			// This callback runs lazily during HTML generation, after
			// handleBetterAuth (below) has already populated `event.locals`,
			// so `event.locals.theme` is safe to read here.
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
					.replace('%theme.value%', event.locals.theme ?? DEFAULT_THEME)
		});
	});

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		const status = await getUserStatus(session.user.id);
		if (status !== 'active') {
			event.locals.session = undefined;
			event.locals.user = undefined;
			event.locals.isAdministrator = false;
			event.locals.isFirstAdministrator = false;
		} else {
			event.locals.session = session.session;
			event.locals.user = session.user;
			event.locals.isAdministrator = await isAdministrator(session.user.id);
			event.locals.isFirstAdministrator = await isFirstAdministrator(session.user);
		}
	}

	// The database is the durable, cross-device source of truth once signed
	// in (memoised, so this is cheap on every request but the first); an
	// anonymous request — the sign-in page, most often — falls back to
	// whatever the cookie last recorded. Re-setting the cookie on every
	// authenticated request keeps it in sync after a change made elsewhere
	// (another device, another tab) without any separate sync path.
	if (event.locals.user) {
		event.locals.theme = (await getThemeSettings(event.locals.user.id)).theme;
		event.cookies.set(THEME_COOKIE, event.locals.theme, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			sameSite: 'lax'
		});
	} else {
		const cookieTheme = event.cookies.get(THEME_COOKIE);
		event.locals.theme = cookieTheme && isTheme(cookieTheme) ? cookieTheme : DEFAULT_THEME;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleParaglide, handleBetterAuth);
