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
	return (
		item.href === currentPath || (item.href !== '/' && currentPath.startsWith(`${item.href}/`))
	);
}
