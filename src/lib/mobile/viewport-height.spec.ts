import { describe, expect, it, vi } from 'vitest';
import {
	readMobileViewportBox,
	setMobileViewportBox,
	standaloneBottomExtension,
	standaloneBottomInset
} from './viewport-height';

describe('readMobileViewportBox', () => {
	it('prefers the visible viewport and retains its offset', () => {
		expect(readMobileViewportBox({ height: 641.5, offsetTop: 24 }, 800)).toEqual({
			height: 641.5,
			offsetTop: 24
		});
	});

	it('falls back to the window height when the visible height is unavailable', () => {
		expect(readMobileViewportBox(null, 720)).toEqual({ height: 720, offsetTop: 0 });
		expect(readMobileViewportBox({ height: 0, offsetTop: Number.NaN }, 720)).toEqual({
			height: 720,
			offsetTop: 0
		});
	});

	it('uses the app viewport in standalone mode when no keyboard is open', () => {
		expect(
			readMobileViewportBox({ height: 720, offsetTop: 12 }, 800, {
				standalone: true
			})
		).toEqual({
			height: 800,
			offsetTop: 0
		});
	});

	it('still follows the smaller visible area when the standalone keyboard opens', () => {
		expect(
			readMobileViewportBox({ height: 470, offsetTop: 32 }, 800, {
				standalone: true,
				keyboardOpen: true
			})
		).toEqual({ height: 470, offsetTop: 32 });
	});
});

describe('setMobileViewportBox', () => {
	it('writes rounded viewport measurements to shell CSS variables', () => {
		const setProperty = vi.fn();
		setMobileViewportBox({ style: { setProperty } } as unknown as HTMLElement, {
			height: 640.444,
			offsetTop: 11.555
		});
		expect(setProperty).toHaveBeenNthCalledWith(1, '--mobile-viewport-height', '640.44px');
		expect(setProperty).toHaveBeenNthCalledWith(2, '--mobile-viewport-top', '11.56px');
	});
});

describe('standaloneBottomInset', () => {
	const iPhone15 = { width: 393, height: 852 };

	it('drops the padding when the window already ends above the home indicator', () => {
		expect(standaloneBottomInset(34, iPhone15, { width: 393, height: 818 })).toBe(0);
	});

	it('keeps the controls clear of the indicator when the window covers it', () => {
		expect(standaloneBottomInset(34, iPhone15, { width: 393, height: 852 })).toBe(34);
		expect(standaloneBottomInset(34, iPhone15, { width: 393, height: 840 })).toBe(22);
	});

	it('measures landscape against the short side, as iOS keeps screen in portrait', () => {
		expect(standaloneBottomInset(21, iPhone15, { width: 852, height: 393 })).toBe(21);
		expect(standaloneBottomInset(21, iPhone15, { width: 852, height: 372 })).toBe(0);
	});

	it('needs no padding without a bottom inset and keeps it when the screen is unknown', () => {
		expect(standaloneBottomInset(0, iPhone15, { width: 393, height: 818 })).toBe(0);
		expect(standaloneBottomInset(34, { width: 0, height: 0 }, { width: 393, height: 818 })).toBe(
			34
		);
	});
});

describe('standaloneBottomExtension', () => {
	const iPhone15 = { width: 393, height: 852 };

	it('extends the portrait shell through the home-indicator strip', () => {
		expect(standaloneBottomExtension(34, iPhone15, { width: 393, height: 818 })).toBe(34);
		expect(standaloneBottomExtension(34, iPhone15, { width: 393, height: 852 })).toBe(0);
	});

	it('does not add portrait-style extension in landscape or without a safe area', () => {
		expect(standaloneBottomExtension(21, iPhone15, { width: 852, height: 393 })).toBe(0);
		expect(standaloneBottomExtension(0, iPhone15, { width: 393, height: 818 })).toBe(0);
	});
});
