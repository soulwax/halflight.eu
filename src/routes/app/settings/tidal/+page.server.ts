import { fail, redirect } from '@sveltejs/kit';
import { getConnectionStatus } from '#lib/server/tidal';
import {
	getStreamingSettings,
	parseStreamingSettingsInput,
	saveStreamingSettings
} from '#lib/server/streaming-settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');
	const [status, streamingSettings] = await Promise.all([
		getConnectionStatus(),
		getStreamingSettings(event.locals.user.id)
	]);

	return {
		status,
		hasFullPlayback: status.hasPlayback,
		streamingSettings,
		notice: {
			connected: event.url.searchParams.has('connected'),
			welcome: event.url.searchParams.has('welcome'),
			disconnected: event.url.searchParams.has('disconnected'),
			error: event.url.searchParams.get('error')
		}
	};
};

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
