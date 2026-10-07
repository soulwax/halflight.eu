import { describe, expect, it, vi } from 'vitest';
import {
	readMobileViewportBox,
	setMobileViewportBox,
	standaloneAppHeight
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

describe('standaloneAppHeight', () => {
	const iPhone15 = { width: 393, height: 852 };

	it('fills the home-indicator strip when the window stops above it', () => {
		expect(standaloneAppHeight(818, iPhone15, 393)).toBe(852);
	});

	it('never overshoots a window that already reaches the bottom of the screen', () => {
		expect(standaloneAppHeight(852, iPhone15, 393)).toBe(852);
	});

	it('measures landscape against the short side', () => {
		expect(standaloneAppHeight(372, iPhone15, 852)).toBe(393);
		expect(standaloneAppHeight(393, iPhone15, 852)).toBe(393);
	});

	it('keeps the window when something else owns a large part of the screen', () => {
		expect(standaloneAppHeight(600, iPhone15, 393)).toBe(600);
		expect(standaloneAppHeight(818, { width: 0, height: 0 }, 393)).toBe(818);
	});
});
