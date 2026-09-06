import type { LucideIcon } from '@lucide/svelte';

export interface AppNavigationItem {
	href: string;
	label: string;
	/** A lucide icon component rendered beside the label in the rail and mobile nav. */
	icon?: LucideIcon;
	/** Override automatic exact/prefix matching when a route needs a custom active state. */
	current?: boolean;
}

export function isCurrentNavigationItem(item: AppNavigationItem, currentPath: string): boolean {
	if (item.current !== undefined) return item.current;
	if (item.href === currentPath) return true;

	// Sub-pages activate their section (`/app/search/x` -> Search), but a
	// section-root item such as `/app` must not match every `/app/*` route.
	const depth = item.href.split('/').filter(Boolean).length;
	return depth >= 2 && currentPath.startsWith(`${item.href}/`);
}
