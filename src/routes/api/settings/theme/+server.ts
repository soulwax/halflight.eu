import { json, type RequestHandler } from '@sveltejs/kit';
import { isDarkTheme, setUserTheme } from '#lib/server/user-settings';

export const POST: RequestHandler = async (event) => {
	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid_json' }, { status: 400 });
	}

	if (!body || typeof body !== 'object' || !('theme' in body)) {
		return json({ error: 'missing_theme' }, { status: 400 });
	}

	const { theme } = body as { theme: unknown };

	if (!isDarkTheme(theme)) {
		return json({ error: 'invalid_theme' }, { status: 400 });
	}

	if (event.locals.user) {
		await setUserTheme(event.locals.user.id, theme);
	}

	event.cookies.set('syn-theme', theme, {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		httpOnly: false
	});

	return json({ ok: true, theme });
};
