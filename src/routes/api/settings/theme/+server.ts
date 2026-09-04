import { json, type RequestHandler } from '@sveltejs/kit';
import {
	isDarkTheme,
	isVisualStyle,
	setUserTheme,
	setUserVisualStyle
} from '#lib/server/user-settings';

export const POST: RequestHandler = async (event) => {
	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid_json' }, { status: 400 });
	}

	if (!body || typeof body !== 'object') {
		return json({ error: 'missing_setting' }, { status: 400 });
	}

	const { theme, visualStyle } = body as { theme?: unknown; visualStyle?: unknown };

	if (theme === undefined && visualStyle === undefined) {
		return json({ error: 'missing_setting' }, { status: 400 });
	}

	if (theme !== undefined && !isDarkTheme(theme)) {
		return json({ error: 'invalid_theme' }, { status: 400 });
	}
	if (visualStyle !== undefined && !isVisualStyle(visualStyle)) {
		return json({ error: 'invalid_visual_style' }, { status: 400 });
	}

	if (event.locals.user) {
		if (theme) await setUserTheme(event.locals.user.id, theme);
		if (visualStyle) await setUserVisualStyle(event.locals.user.id, visualStyle);
	}

	if (theme) {
		event.cookies.set('syn-theme', theme, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			sameSite: 'lax',
			httpOnly: false
		});
	}
	if (visualStyle) {
		event.cookies.set('syn-visual-style', visualStyle, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			sameSite: 'lax',
			httpOnly: false
		});
	}

	return json({ ok: true, ...(theme ? { theme } : {}), ...(visualStyle ? { visualStyle } : {}) });
};
