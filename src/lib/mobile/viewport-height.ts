export interface MobileViewportBox {
	height: number;
	offsetTop: number;
}

export interface MobileViewportMode {
	standalone?: boolean;
	keyboardOpen?: boolean;
}

/**
 * Browsers need the visible viewport so their address bar is not covered. An
 * installed app has no browser chrome, so use the app viewport unless its
 * software keyboard is actively shrinking the visible area.
 */
export function readMobileViewportBox(
	visualViewport: Pick<VisualViewport, 'height' | 'offsetTop'> | null | undefined,
	innerHeight: number,
	mode: MobileViewportMode = {}
): MobileViewportBox {
	const visualHeight = visualViewport?.height;
	const validVisualHeight =
		typeof visualHeight === 'number' && Number.isFinite(visualHeight) && visualHeight > 0
			? visualHeight
			: null;
	const useVisibleViewport = !mode.standalone || mode.keyboardOpen;
	const height = useVisibleViewport ? (validVisualHeight ?? innerHeight) : innerHeight;
	const visualOffset = visualViewport?.offsetTop;
	const offsetTop =
		useVisibleViewport && typeof visualOffset === 'number' && Number.isFinite(visualOffset)
			? visualOffset
			: 0;
	return {
		height: Number.isFinite(height) && height > 0 ? height : 0,
		offsetTop
	};
}

export function setMobileViewportBox(element: HTMLElement, box: MobileViewportBox): void {
	const height = Math.round(box.height * 100) / 100;
	const offsetTop = Math.round(box.offsetTop * 100) / 100;
	element.style.setProperty('--mobile-viewport-height', `${height}px`);
	element.style.setProperty('--mobile-viewport-top', `${offsetTop}px`);
}
