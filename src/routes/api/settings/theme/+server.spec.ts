import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		setUserTheme: vi.fn(),
		setUserVisualStyle: vi.fn()
	};
});

vi.mock('#lib/server/user-settings', async () => {
	const actual = await vi.importActual<typeof import('#lib/server/user-settings')>(
		'#lib/server/user-settings'
	);
	return {
		...actual,
		setUserTheme: mocks.setUserTheme,
		setUserVisualStyle: mocks.setUserVisualStyle
	};
});

import type { Cookies } from '@sveltejs/kit';
import { POST } from './+server';

describe('POST /api/settings/theme', () => {
	let mockCookies: { set: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		mocks.setUserTheme.mockReset();
		mocks.setUserVisualStyle.mockReset();
		mockCookies = { set: vi.fn() };
	});

	function makeEvent(
		body: unknown,
		user: { id: string } | null = { id: 'u1' },
		jsonThrows = false
	) {
		return {
			locals: { user },
			request: {
				json: jsonThrows
					? vi.fn().mockRejectedValue(new Error('Invalid JSON'))
					: vi.fn().mockResolvedValue(body)
			},
			cookies: mockCookies as unknown as Cookies
		} as unknown as Parameters<typeof POST>[0];
	}

	it('returns 400 for malformed json', async () => {
		const res = await POST(makeEvent(null, { id: 'u1' }, true));
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBe('invalid_json');
	});

	it('returns 400 for a request without an appearance setting', async () => {
		const res = await POST(makeEvent({ other: 'value' }));
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBe('missing_setting');
	});

	it('returns 400 for invalid or light theme', async () => {
		const res = await POST(makeEvent({ theme: 'light' }));
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBe('invalid_theme');
	});

	it('persists theme to db for authenticated user and sets cookie', async () => {
		mocks.setUserTheme.mockResolvedValue({ theme: 'tokyo-night' });
		const res = await POST(makeEvent({ theme: 'tokyo-night' }, { id: 'u123' }));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.ok).toBe(true);
		expect(data.theme).toBe('tokyo-night');
		expect(mocks.setUserTheme).toHaveBeenCalledWith('u123', 'tokyo-night');
		expect(mockCookies.set).toHaveBeenCalledWith(
			'syn-theme',
			'tokyo-night',
			expect.objectContaining({ path: '/', httpOnly: false })
		);
	});

	it('sets cookie even for unauthenticated visitor without calling setUserTheme', async () => {
		const res = await POST(makeEvent({ theme: 'nord' }, null));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.ok).toBe(true);
		expect(data.theme).toBe('nord');
		expect(mocks.setUserTheme).not.toHaveBeenCalled();
		expect(mockCookies.set).toHaveBeenCalledWith('syn-theme', 'nord', expect.any(Object));
	});

	it('persists visual style independently', async () => {
		mocks.setUserVisualStyle.mockResolvedValue({ theme: 'nord', visualStyle: 'cubism' });
		const res = await POST(makeEvent({ visualStyle: 'cubism' }, { id: 'u123' }));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ ok: true, visualStyle: 'cubism' });
		expect(mocks.setUserVisualStyle).toHaveBeenCalledWith('u123', 'cubism');
		expect(mockCookies.set).toHaveBeenCalledWith(
			'syn-visual-style',
			'cubism',
			expect.objectContaining({ path: '/', httpOnly: false })
		);
	});

	it('rejects an unknown visual style', async () => {
		const res = await POST(makeEvent({ visualStyle: 'minimalism' }));
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBe('invalid_visual_style');
	});
});
