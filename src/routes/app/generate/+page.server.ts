import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getTasteProfile } from '#lib/server/taste/profile';
import { generateTasteSet, type ProvisionalSet } from '#lib/server/taste/generate';
import { createLiveGraphClient } from '#lib/server/taste/graph';
import { getConnectionStatus } from '#lib/server/tidal';
import { getArtist } from '#lib/server/tidal/api';
import type { PageServerLoad } from './$types';

export interface SeedArtistOption {
	id: string;
	name: string;
	weight: number;
}

export const load: PageServerLoad = async (event) => {
	const user = event.locals.user;
	if (!user) {
		throw redirect(303, resolve('/sign-in'));
	}

	const profile = await getTasteProfile(user.id);
	const connection = await getConnectionStatus();

	// Resolve names for top anchor artists (up to 6) to offer as seed options
	const sortedArtistEntries = Object.entries(profile.artists).sort(([, a], [, b]) => b - a);
	const topArtistEntries = sortedArtistEntries.slice(0, 6);

	const seedArtists: SeedArtistOption[] = await Promise.all(
		topArtistEntries.map(async ([id, weight]) => {
			let name = id;
			if (connection.connected) {
				try {
					const doc = await getArtist(id, {}, { fetch: event.fetch, cookies: event.cookies });
					if (doc.data?.attributes && 'name' in doc.data.attributes) {
						name = String(doc.data.attributes.name);
					}
				} catch {
					// Fallback
				}
			}
			return { id, name, weight };
		})
	);

	return {
		profile,
		connection,
		seedArtists
	};
};

export const actions: Actions = {
	generate: async (event) => {
		const user = event.locals.user;
		if (!user) throw error(401, 'Unauthorized');

		const connection = await getConnectionStatus();
		if (!connection.connected) {
			return fail(409, { error: 'TIDAL connection required to generate from your taste graph.' });
		}

		const data = await event.request.formData();
		const targetCount = Math.max(5, Math.min(50, Number(data.get('targetCount') ?? 20)));
		const familiarity = Math.max(0, Math.min(100, Number(data.get('familiarity') ?? 50)));
		const seedArtistId = String(data.get('seedArtistId') ?? '').trim() || undefined;

		const profile = await getTasteProfile(user.id);
		const client = createLiveGraphClient({ fetch: event.fetch, cookies: event.cookies });

		try {
			const set: ProvisionalSet = await generateTasteSet(profile, {
				knobs: { targetCount, familiarity, seedArtistId },
				client
			});

			return {
				success: true,
				set
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Generation failed.';
			return fail(500, { error: message });
		}
	}
};
