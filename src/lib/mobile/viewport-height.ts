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
 * software keyboard is actively shrinking the visible area. The PWA's extra
 * bottom safe area is painted separately and must not move the controls.
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

/**
 * Bottom padding the installed app's tab bar and mini player still need.
 *
 * In the browser the bottom chrome pads by the whole `safe-area-inset-bottom`.
 * An installed iOS app can instead end its window above the home-indicator
 * strip (that strip is painted to match the navigation), so padding by the full
 * inset as well counts the same space twice and floats the navigation high
 * above the bottom edge. Subtract whatever the screen already leaves below the
 * window. iOS keeps `screen` in portrait axes, so compare against the side that
 * matches the current orientation.
 */
export function standaloneBottomInset(
	safeAreaBottom: number,
	screen: Pick<Screen, 'width' | 'height'>,
	viewport: { width: number; height: number }
): number {
	if (!Number.isFinite(safeAreaBottom) || safeAreaBottom <= 0) return 0;
	const long = Math.max(screen.width, screen.height);
	const short = Math.min(screen.width, screen.height);
	const screenExtent = viewport.width > viewport.height ? short : long;
	if (!Number.isFinite(screenExtent) || screenExtent <= 0) return safeAreaBottom;
	const stripBelowWindow = Math.max(0, screenExtent - viewport.height);
	return Math.max(0, safeAreaBottom - stripBelowWindow);
}
