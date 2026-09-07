import { getTextDirection } from '#lib/paraglide/runtime';
import { paraglideMiddleware } from '#lib/paraglide/server';
import { getUserStatus, isAdministrator, isFirstAdministrator } from '#lib/server/admin';
import { auth } from '#lib/server/auth';
import { building } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		// SvelteKit 3 types `event.request` as readonly; paraglide returns a
		// request with a de-localised URL that downstream handlers should see.
		(event as { request: Request }).request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
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

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleParaglide, handleBetterAuth);
