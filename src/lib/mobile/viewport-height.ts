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

/** Extra portrait PWA space painted below the app viewport for the home indicator. */
export function standaloneBottomExtension(
	safeAreaBottom: number,
	screen: Pick<Screen, 'width' | 'height'>,
	viewport: { width: number; height: number }
): number {
	if (!Number.isFinite(safeAreaBottom) || safeAreaBottom <= 0) return 0;
	if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.height <= 0)
		return 0;
	const short = Math.min(screen.width, screen.height);
	if (!Number.isFinite(short) || short <= 0 || viewport.width > short) return 0;
	// In installed portrait iOS, use the safe-area measurement itself. The screen
	// dimensions can include browser/system strips that aren't part of the app's
	// layout viewport, creating a large false extension and empty bottom region.
	return Math.min(safeAreaBottom, 48);
}
