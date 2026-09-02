import {
	ORIGIN,
	BETTER_AUTH_SECRET,
	GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET
} from '$app/env/private';

import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '#lib/server/db';
import {
	getAdministratorEmail,
	hasAdministratorPassword,
	isConfiguredAdministratorUsername
} from '#lib/server/admin';

export const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true },
	account: {
		accountLinking: {
			trustedProviders: ['github'],
			// The synthetic admin email is never verified by any real email flow, so
			// requiring local verification would permanently block GitHub linking.
			requireLocalEmailVerified: false
		}
	},
	databaseHooks: {
		user: {
			create: {
				before: async (user, context) => {
					if (user.email !== getAdministratorEmail()) return false;

					if (context?.path === '/sign-up/email') {
						const password = context.body?.password;
						return typeof password === 'string' && hasAdministratorPassword(password);
					}

					return context?.path === '/callback/github';
				}
			}
		}
	},
	socialProviders: {
		github: {
			clientId: GITHUB_CLIENT_ID,
			clientSecret: GITHUB_CLIENT_SECRET,
			disableSignUp: true,
			mapProfileToUser: (profile) =>
				isConfiguredAdministratorUsername(profile.login) ? { email: getAdministratorEmail() } : {}
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
