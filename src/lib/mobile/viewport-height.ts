export interface MobileViewportBox {
	height: number;
	offsetTop: number;
}

/** Prefer the visible viewport (including browser chrome and keyboard changes). */
export function readMobileViewportBox(
	visualViewport: Pick<VisualViewport, 'height' | 'offsetTop'> | null | undefined,
	innerHeight: number
): MobileViewportBox {
	const visualHeight = visualViewport?.height;
	const height =
		typeof visualHeight === 'number' && Number.isFinite(visualHeight) && visualHeight > 0
			? visualHeight
			: innerHeight;
	const visualOffset = visualViewport?.offsetTop;
	const offsetTop =
		typeof visualOffset === 'number' && Number.isFinite(visualOffset) ? visualOffset : 0;
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
