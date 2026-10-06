import { describe, expect, it, vi } from 'vitest';
import { readMobileViewportBox, setMobileViewportBox } from './viewport-height';

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
