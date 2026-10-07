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

/** Most an installed app's window may fall short of the screen and still be filled. */
const MAX_STANDALONE_SHORTFALL = 64;

/**
 * Height for the installed app's shell: the whole physical screen.
 *
 * With `viewport-fit=cover` and a translucent status bar the web view owns the
 * entire display, but iOS can report a window (`innerHeight`) that ends at the
 * top of the home-indicator strip. Sizing to the window then leaves that strip
 * empty, and adding the safe-area inset on top overshoots whenever the window
 * already reaches the bottom. Fill to the screen extent in the current
 * orientation instead (iOS keeps `screen` in portrait axes); a larger gap means
 * something else owns the space, such as a split view, so keep the window then.
 */
export function standaloneAppHeight(
	innerHeight: number,
	screen: Pick<Screen, 'width' | 'height'>,
	viewportWidth: number
): number {
	if (!Number.isFinite(innerHeight) || innerHeight <= 0) return 0;
	const long = Math.max(screen.width, screen.height);
	const short = Math.min(screen.width, screen.height);
	if (!Number.isFinite(short) || short <= 0) return innerHeight;
	const extent = viewportWidth > short ? short : long;
	const shortfall = extent - innerHeight;
	return shortfall > 0 && shortfall <= MAX_STANDALONE_SHORTFALL ? extent : innerHeight;
}
