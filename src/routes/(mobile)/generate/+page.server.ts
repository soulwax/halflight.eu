import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getGenerationCooldownTrackIds } from '#lib/server/taste/cooldown';
import { generateTasteSet, type ProvisionalSet } from '#lib/server/taste/generate';
import { parseGenerateTasteSetInput } from '#lib/server/taste/generate-input';
import { createLiveGraphClient } from '#lib/server/taste/graph';
import { getTasteProfile } from '#lib/server/taste/profile';
import { getArtist } from '#lib/server/tidal/api';
import { getConnectionStatus } from '#lib/server/tidal';
import type { PageServerLoad } from './$types';

interface SeedArtistOption {
	id: string;
	name: string;
}

export const load: PageServerLoad = async (event) => {
	const user = event.locals.user;
	if (!user || !event.locals.isAdministrator) throw redirect(303, resolve('/sign-in'));

	const [profile, connection] = await Promise.all([
		getTasteProfile(user.id),
		getConnectionStatus()
	]);
	const anchorIds = Object.entries(profile.artists)
		.sort(([, left], [, right]) => right - left)
		.slice(0, 3)
		.map(([id]) => id);

	const seedArtists: SeedArtistOption[] = await Promise.all(
		anchorIds.map(async (id) => {
			if (!connection.connected) return { id, name: id };
			try {
				const document = await getArtist(id, {}, { fetch: event.fetch, cookies: event.cookies });
				const attributes = document.data?.attributes;
				const name = attributes && 'name' in attributes ? (attributes.name as unknown) : undefined;
				return { id, name: typeof name === 'string' && name.trim() ? name : id };
			} catch {
				return { id, name: id };
			}
		})
	);

	return { connection, seedArtists };
};

export const actions: Actions = {
	generate: async (event) => {
		const user = event.locals.user;
		if (!user || !event.locals.isAdministrator) throw error(401, 'Unauthorized');

		const connection = await getConnectionStatus();
		if (!connection.connected) return fail(409, { errorCode: 'generation_connection_required' });

		const input = parseGenerateTasteSetInput(await event.request.formData());
		if (!input.success) return fail(400, { errorCode: 'invalid_generation_input' });

		const [profile, cooldownTrackIds] = await Promise.all([
			getTasteProfile(user.id),
			getGenerationCooldownTrackIds(user.id)
		]);

		try {
			const set: ProvisionalSet = await generateTasteSet(profile, {
				knobs: input.output,
				cooldownTrackIds,
				client: createLiveGraphClient({ fetch: event.fetch, cookies: event.cookies })
			});
			return { success: true, set };
		} catch {
			return fail(502, { errorCode: 'generation_unavailable' });
		}
	}
};
