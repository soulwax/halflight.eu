import { fail, redirect } from '@sveltejs/kit';
import { parseThemeSettingsInput, saveThemeSettings, THEMES } from '#lib/server/theme-settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (!event.locals.user) redirect(302, '/sign-in');

	// hooks.server.ts already resolved and memoised this for the response's
	// own `data-theme` attribute; reuse it rather than reading the store again.
	// Labels resolve client-side via `getThemeLabel` (`#lib/theme.ts`), so
	// there's no metadata to send beyond the id list itself.
	return {
		theme: event.locals.theme,
		themes: THEMES
	};
};

export const actions: Actions = {
	saveTheme: async (event) => {
		if (!event.locals.user) redirect(302, '/sign-in');

		const formData = await event.request.formData();
		const settings = parseThemeSettingsInput({ theme: formData.get('theme')?.toString() });
		if (!settings) return fail(400, { themeError: true });

		const saved = await saveThemeSettings(event.locals.user.id, settings);
		return { themeSaved: true, theme: saved.theme };
	}
};
