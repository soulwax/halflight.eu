export interface AppNavigationItem {
	href: string;
	label: string;
	/** Override automatic exact/prefix matching when a route needs a custom active state. */
	current?: boolean;
}

export interface AppBrand {
	href: string;
	label: string;
}

export function isCurrentNavigationItem(item: AppNavigationItem, currentPath: string): boolean {
	if (item.current !== undefined) return item.current;
	if (item.href === currentPath) return true;

	// Sub-pages activate their section (`/app/search/x` -> Search), but a
	// section-root item such as `/app` must not match every `/app/*` route.
	const depth = item.href.split('/').filter(Boolean).length;
	return depth >= 2 && currentPath.startsWith(`${item.href}/`);
}
