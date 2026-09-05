import { fail, redirect } from '@sveltejs/kit';
import { parseStreamingSettingsInput, saveStreamingSettings } from '#lib/server/streaming-settings';
import type { Actions } from './$types';

export const actions: Actions = {
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
	}
};
