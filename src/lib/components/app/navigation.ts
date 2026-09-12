import { deLocalizeHref } from '#lib/paraglide/runtime';
import type { LucideIcon } from '@lucide/svelte';

export interface AppNavigationItem {
	href: string;
	label: string;
	/** A lucide icon component rendered beside the label in the rail and mobile nav. */
	icon?: LucideIcon;
	/** Add a quiet visual break before this item in the desktop listening-room rail. */
	dividerBefore?: boolean;
	/** Override automatic exact/prefix matching when a route needs a custom active state. */
	current?: boolean;
}

export function isCurrentNavigationItem(item: AppNavigationItem, currentPath: string): boolean {
	if (item.current !== undefined) return item.current;
	const href = deLocalizeHref(item.href);
	const path = deLocalizeHref(currentPath);
	if (href === path) return true;

	// Sub-pages activate their section (`/app/search/x` -> Search), but a
	// section-root item such as `/app` must not match every `/app/*` route.
	const depth = href.split('/').filter(Boolean).length;
	return depth >= 2 && path.startsWith(`${href}/`);
}
