import { fail, redirect } from '@sveltejs/kit';
import { parseStreamingSettingsInput, saveStreamingSettings } from '#lib/server/streaming-settings';
import { parseThemeSettingsInput, saveThemeSettings, THEMES } from '#lib/server/theme-settings';
import {
	getListeningPreferences,
	saveListeningPreferencesForm
} from '#lib/server/listening-preferences';
import { clearHalflightListening, clearLastfmEvidence } from '#lib/server/taste/listening-store';
import type { Actions, PageServerLoad } from './$types';
import { getStorageOverview } from '#lib/server/storage';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');

	// Labels resolve client-side via `getThemeLabel` (`#lib/theme.ts`).
	const [storage, listeningPreferences] = await Promise.all([
		getStorageOverview(event.locals.user.id),
		getListeningPreferences(event.locals.user.id)
	]);
	return { themes: THEMES, storage, listeningPreferences };
};

export const actions: Actions = {
	saveListeningPreferences: async (event) => {
		const user = event.locals.user;
		if (!user) redirect(302, '/sign-in');
		const saved = await saveListeningPreferencesForm(
			user.id,
			await event.request.formData(),
			clearLastfmEvidence
		);
		if (!saved) return fail(400, { listeningPreferencesError: true });
		return { listeningPreferencesSaved: true };
	},

	forgetListening: async (event) => {
		const user = event.locals.user;
		if (!user) redirect(302, '/sign-in');
		await clearHalflightListening(user.id);
		return { listeningForgotten: true };
	},
	saveStreamingSettings: async (event) => {
		if (!event.locals.user) redirect(302, '/sign-in');

		const formData = await event.request.formData();
		const settings = parseStreamingSettingsInput({
			preferredQuality: formData.get('preferredQuality')?.toString(),
			volume: formData.get('volume')?.toString(),
			loudnessNormalization: formData.get('loudnessNormalization')?.toString()
		});
		if (!settings) return fail(400, { streamingSettingsError: true });

		await saveStreamingSettings(event.locals.user.id, settings);
		return { streamingSettingsSaved: true };
	},

	saveTheme: async (event) => {
		if (!event.locals.user) redirect(302, '/sign-in');

		const formData = await event.request.formData();
		const settings = parseThemeSettingsInput({ theme: formData.get('theme')?.toString() });
		if (!settings) return fail(400, { themeError: true });

		const saved = await saveThemeSettings(event.locals.user.id, settings);
		return { themeSaved: true, theme: saved.theme };
	}
};
