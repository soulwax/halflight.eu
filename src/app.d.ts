import type { User, Session } from 'better-auth';
import type { Theme } from '#lib/server/theme-settings';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
			/** Any signed-in, active user: may use the player and their own library. */
			isListener?: boolean;
			/** Manages other users; gates `/app/admin` only. */
			isAdministrator?: boolean;
			isFirstAdministrator?: boolean;
			/** Resolved once per request in hooks.server.ts: DB for a signed-in
			 *  user, otherwise the `hf-theme` cookie. Baked into `<html data-theme>`
			 *  via `transformPageChunk` before first paint. */
			theme: Theme;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
