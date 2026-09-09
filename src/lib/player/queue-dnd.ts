import type { ActionReturn } from 'svelte/action';
import {
	overrideItemIdKeyNameBeforeInitialisingDndZones,
	dndzone as dndzoneAction,
	type DndEvent,
	type Options,
	type Item
} from 'svelte-dnd-action';

let initialized = false;

export function ensureQueueDndInitialized(): void {
	if (initialized || typeof window === 'undefined') return;
	try {
		overrideItemIdKeyNameBeforeInitialisingDndZones('entryId');
		initialized = true;
	} catch {
		// Dropzones already active or already set
	}
}

export interface QueueDndOptions<T> {
	items: T[];
	flipDurationMs?: number;
	dropTargetStyle?: Record<string, string>;
	dragDisabled?: boolean;
}

export interface QueueDndAttributes<T> {
	onconsider?: (e: CustomEvent<DndEvent<T>>) => void;
	onfinalize?: (e: CustomEvent<DndEvent<T>>) => void;
}

/**
 * A queue-specific dndzone action ensuring items are keyed by `entryId`.
 */
export function queueDndZone<T extends object>(
	node: HTMLElement,
	options: QueueDndOptions<T>
): ActionReturn<QueueDndOptions<T>, QueueDndAttributes<T>> {
	ensureQueueDndInitialized();
	return dndzoneAction(node, options as unknown as Options<Item>) as unknown as ActionReturn<
		QueueDndOptions<T>,
		QueueDndAttributes<T>
	>;
}

export type { DndEvent };
