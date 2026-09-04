import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import {
	getTasteProfile,
	refreshTasteProfile,
	resetTasteProfile,
	deleteTasteProfile,
	updateTasteProfileCustomizations,
	type TasteProfile
} from '#lib/server/taste/profile';
import { getConnectionStatus } from '#lib/server/tidal';
import { getArtist } from '#lib/server/tidal/api';
import type { PageServerLoad } from './$types';

export interface AnchorArtistItem {
	id: string;
	name: string;
	weight: number;
	status: 'normal' | 'pinned' | 'dampened' | 'excluded';
}

export interface EraDistributionItem {
	decade: number;
	weight: number;
	percentage: number;
	isExcluded: boolean;
}

export const load: PageServerLoad = async (event) => {
	const user = event.locals.user;
	if (!user) {
		throw redirect(303, resolve('/sign-in'));
	}

	const profile = await getTasteProfile(user.id);
	const connection = await getConnectionStatus();

	// Resolve names for top anchor artists (up to 8)
	const sortedArtistEntries = Object.entries(profile.artists).sort(([, a], [, b]) => b - a);
	const topArtistEntries = sortedArtistEntries.slice(0, 8);

	const anchorArtists: AnchorArtistItem[] = await Promise.all(
		topArtistEntries.map(async ([id, weight]) => {
			let name = id;
			if (connection.connected) {
				try {
					const doc = await getArtist(id, {}, { fetch: event.fetch, cookies: event.cookies });
					if (doc.data?.attributes && 'name' in doc.data.attributes) {
						name = String(doc.data.attributes.name);
					}
				} catch {
					// Fallback to ID if network fails or rate limited
				}
			}

			let status: 'normal' | 'pinned' | 'dampened' | 'excluded' = 'normal';
			if (profile.exclusions.artists.includes(id)) {
				status = 'excluded';
			} else if (profile.overrides.artists[id]) {
				status = profile.overrides.artists[id];
			}

			return { id, name, weight, status };
		})
	);

	// Also resolve any excluded artists that might not be in top weights
	const excludedArtists: { id: string; name: string }[] = await Promise.all(
		profile.exclusions.artists.map(async (id) => {
			const existing = anchorArtists.find((a) => a.id === id);
			if (existing) return { id, name: existing.name };
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
			return { id, name };
		})
	);

	// Compute era distribution
	const eraEntries = Object.entries(profile.eras)
		.map(([decade, weight]) => ({ decade: Number(decade), weight }))
		.sort((a, b) => b.weight - a.weight);

	const totalEraWeight = eraEntries.reduce((acc, curr) => acc + curr.weight, 0);
	const eraDistribution: EraDistributionItem[] = eraEntries.map((item) => ({
		...item,
		percentage: totalEraWeight > 0 ? Math.round((item.weight / totalEraWeight) * 100) : 0,
		isExcluded: profile.exclusions.eras.includes(item.decade)
	}));

	// Plain-language sentence synthesis
	let artistSentence =
		'No anchor artists have been identified yet. Connect your TIDAL account and build your profile to start.';
	if (anchorArtists.length > 0) {
		const names = anchorArtists.slice(0, 3).map((a) => a.name);
		if (names.length === 1) {
			artistSentence = `Your primary anchor artist is ${names[0]}.`;
		} else if (names.length === 2) {
			artistSentence = `Your primary anchor artists are ${names[0]} and ${names[1]}.`;
		} else {
			artistSentence = `Your primary anchor artists are ${names[0]}, ${names[1]}, and ${names[2]}.`;
		}
	}

	let eraSentence = 'Your profile has not detected era preferences yet.';
	if (eraDistribution.length > 0) {
		const topEras = eraDistribution.slice(0, 2);
		if (topEras.length === 1) {
			eraSentence = `You primarily listen to music from the ${topEras[0].decade}s.`;
		} else {
			eraSentence = `You spend most of your listening time in the ${topEras[0].decade}s (${topEras[0].percentage}%) and ${topEras[1].decade}s (${topEras[1].percentage}%).`;
		}
	}

	const avgConfidence = (profile.confidence.artists + profile.confidence.eras) / 2;
	let confidenceLevel: 'initial' | 'moderate' | 'high' = 'initial';
	let confidenceSentence =
		'Initial confidence: the taste engine has limited evidence from your TIDAL account and will remain conservative.';

	if (avgConfidence >= 0.7) {
		confidenceLevel = 'high';
		confidenceSentence =
			'High confidence: strong signals across playlists, followed artists, and sessions allow nuanced curation.';
	} else if (avgConfidence >= 0.3) {
		confidenceLevel = 'moderate';
		confidenceSentence =
			'Moderate confidence: sufficient signals to anchor your taste with balanced discovery.';
	}

	return {
		profile,
		connection,
		anchorArtists,
		excludedArtists,
		eraDistribution,
		sentences: {
			artistSentence,
			eraSentence,
			confidenceSentence,
			confidenceLevel,
			confidenceScore: Math.round(avgConfidence * 100)
		}
	};
};

export const actions: Actions = {
	rebuild: async (event) => {
		const user = event.locals.user;
		if (!user) throw error(401, 'Unauthorized');

		const connection = await getConnectionStatus();
		if (!connection.connected) {
			return fail(409, { error: 'TIDAL connection required to refresh taste signals.' });
		}

		try {
			await refreshTasteProfile(user.id, {
				ctx: { fetch: event.fetch, cookies: event.cookies }
			});
			return { success: true, message: 'Profile refreshed from live TIDAL signals.' };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to refresh profile.';
			return fail(500, { error: message });
		}
	},

	reset: async (event) => {
		const user = event.locals.user;
		if (!user) throw error(401, 'Unauthorized');

		try {
			await resetTasteProfile(user.id);
			return { success: true, message: 'Taste profile reset to blank defaults.' };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to reset profile.';
			return fail(500, { error: message });
		}
	},

	delete: async (event) => {
		const user = event.locals.user;
		if (!user) throw error(401, 'Unauthorized');

		try {
			await deleteTasteProfile(user.id);
			return { success: true, message: 'Taste profile deleted from storage.' };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to delete profile.';
			return fail(500, { error: message });
		}
	},

	overrideArtist: async (event) => {
		const user = event.locals.user;
		if (!user) throw error(401, 'Unauthorized');

		const data = await event.request.formData();
		const artistId = String(data.get('artistId') ?? '').trim();
		const mode = String(data.get('mode') ?? '').trim();

		if (!artistId) return fail(400, { error: 'Missing artist ID.' });

		await updateTasteProfileCustomizations(user.id, (profile: TasteProfile) => {
			if (mode === 'pinned' || mode === 'dampened') {
				profile.overrides.artists[artistId] = mode;
				// Remove from exclusions if it was excluded
				profile.exclusions.artists = profile.exclusions.artists.filter((id) => id !== artistId);
			} else {
				delete profile.overrides.artists[artistId];
			}
		});

		return { success: true };
	},

	excludeArtist: async (event) => {
		const user = event.locals.user;
		if (!user) throw error(401, 'Unauthorized');

		const data = await event.request.formData();
		const artistId = String(data.get('artistId') ?? '').trim();
		if (!artistId) return fail(400, { error: 'Missing artist ID.' });

		await updateTasteProfileCustomizations(user.id, (profile: TasteProfile) => {
			if (!profile.exclusions.artists.includes(artistId)) {
				profile.exclusions.artists.push(artistId);
			}
			delete profile.overrides.artists[artistId];
			delete profile.artists[artistId];
		});

		return { success: true };
	},

	removeExclusion: async (event) => {
		const user = event.locals.user;
		if (!user) throw error(401, 'Unauthorized');

		const data = await event.request.formData();
		const artistId = String(data.get('artistId') ?? '').trim();
		if (!artistId) return fail(400, { error: 'Missing artist ID.' });

		await updateTasteProfileCustomizations(user.id, (profile: TasteProfile) => {
			profile.exclusions.artists = profile.exclusions.artists.filter((id) => id !== artistId);
		});

		return { success: true };
	}
};
