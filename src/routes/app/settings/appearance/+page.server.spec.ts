import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	saveThemeSettings: vi.fn()
}));

vi.mock('#lib/server/theme-settings', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#lib/server/theme-settings')>();
	return {
		...actual,
		saveThemeSettings: mocks.saveThemeSettings
	};
});

import { actions, load } from './+page.server';

function event(locals: Record<string, unknown> = { user: { id: 'user-1' }, theme: 'dark' }) {
	return {
		url: new URL('http://localhost/app/settings/appearance'),
		locals
	} as unknown as Parameters<typeof load>[0];
}

describe('/app/settings/appearance load', () => {
	beforeEach(() => {
		mocks.saveThemeSettings.mockReset();
	});

	it('reuses the theme hooks.server.ts already resolved, without reading the store again', () => {
		const result = load(event());
		expect(result).toMatchObject({ theme: 'dark' });
		expect(result).toHaveProperty('themes');
	});

	it('redirects an unauthenticated visitor to sign-in', () => {
		expect(() => load(event({ user: undefined }))).toThrow();
	});
});

describe('/app/settings/appearance actions.saveTheme', () => {
	beforeEach(() => {
		mocks.saveThemeSettings.mockReset();
	});

	it('persists a valid theme choice', async () => {
		mocks.saveThemeSettings.mockResolvedValue({ theme: 'electric' });
		const request = new Request('http://localhost/app/settings/appearance?/saveTheme', {
			method: 'POST',
			body: new URLSearchParams({ theme: 'electric' })
		});

		const result = await actions.saveTheme({ ...event(), request } as never);

		expect(mocks.saveThemeSettings).toHaveBeenCalledWith('user-1', { theme: 'electric' });
		expect(result).toEqual({ themeSaved: true, theme: 'electric' });
	});

	it('rejects an unknown theme id without touching the store', async () => {
		const request = new Request('http://localhost/app/settings/appearance?/saveTheme', {
			method: 'POST',
			body: new URLSearchParams({ theme: 'neon' })
		});

		const result = await actions.saveTheme({ ...event(), request } as never);

		expect(mocks.saveThemeSettings).not.toHaveBeenCalled();
		expect(result).toMatchObject({ status: 400, data: { themeError: true } });
	});
});
