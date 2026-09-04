import { createHash } from 'node:crypto';
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
import { sendVerificationEmail } from '#lib/server/email';
import { getAdministratorEmail, isConfiguredAdministratorUsername } from '#lib/server/admin';

/**
 * GitHub's `/user` endpoint omits `email` whenever the account's address is
 * private, unverified, or — notably — when the configured credentials are a
 * GitHub App rather than a classic OAuth App: a GitHub App ignores the
 * `user:email` scope entirely and gates it behind the app's own "Email
 * addresses" account permission instead. Either way, Better Auth refuses to
 * create a user with no email, which fails sign-in outright rather than
 * degrading. Synthesize a private, deterministic one instead of a hard 500.
 *
 * The configured admin resolves to the same synthetic address `admin.ts`
 * already uses everywhere else it identifies the owner by email; any other
 * GitHub login gets its own stable placeholder.
 */
function placeholderGithubEmail(login: string): string {
	if (isConfiguredAdministratorUsername(login)) return getAdministratorEmail(login);
	const digest = createHash('sha256').update(login.trim().toLocaleLowerCase('en-US')).digest('hex');
	return `github-${digest}@syn.invalid`;
}

export const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true, requireEmailVerification: true },
	emailVerification: {
		sendOnSignUp: true,
		sendOnSignIn: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url }) => {
			await sendVerificationEmail({ to: user.email, name: user.name, url });
		}
	},
	account: {
		accountLinking: {
			trustedProviders: ['github']
		}
	},
	socialProviders: {
		github: {
			clientId: GITHUB_CLIENT_ID,
			clientSecret: GITHUB_CLIENT_SECRET,
			disableSignUp: false,
			mapProfileToUser: (profile) =>
				profile.email ? {} : { email: placeholderGithubEmail(profile.login) }
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
