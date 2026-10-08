import type { Component } from 'svelte';
import type { Point } from './placement';

export interface ContextAction {
	id: string;
	/** Accessible name and tooltip; the bar itself shows only the symbol. */
	label: string;
	icon: Component<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>;
	onSelect: () => void | Promise<void>;
	disabled?: boolean;
	tone?: 'danger';
}

export type ContextActionSource = () => ContextAction[];

class ContextMenuState {
	open = $state(false);
	anchor = $state<Point>({ x: 0, y: 0 });
	actions = $state<ContextAction[]>([]);
	/** Short confirmation shown briefly after an action (e.g. "Link copied"). */
	feedback = $state('');
	/** Where focus returns when the bar closes. */
	private returnFocus: HTMLElement | null = null;
	private feedbackTimer: ReturnType<typeof setTimeout> | undefined;

	show(anchor: Point, actions: ContextAction[], returnFocus: HTMLElement | null): void {
		if (!actions.length) return;
		this.anchor = anchor;
		this.actions = actions;
		this.returnFocus = returnFocus;
		this.open = true;
	}

	close(restoreFocus = false): void {
		if (!this.open) return;
		this.open = false;
		if (restoreFocus) this.returnFocus?.focus({ preventScroll: true });
		this.returnFocus = null;
	}

	notify(message: string): void {
		this.feedback = message;
		clearTimeout(this.feedbackTimer);
		this.feedbackTimer = setTimeout(() => (this.feedback = ''), 2_000);
	}
}

export const contextMenu = new ContextMenuState();

function isEditable(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		Boolean(
			target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
		)
	);
}

/**
 * Attach a context bar to an element. Right-click, the Menu key and Shift+F10
 * open it. Touch long-presses are left alone: they drag queue rows, and touch
 * surfaces already have their action sheet. Shift+right-click, editable fields
 * and selected text keep the browser's own menu.
 */
export function contextActions(node: HTMLElement, source: ContextActionSource | undefined) {
	let current = source;
	function onContextMenu(event: MouseEvent) {
		if (!current || event.shiftKey || isEditable(event.target)) return;
		if ('pointerType' in event && (event as PointerEvent).pointerType === 'touch') return;
		if (window.getSelection()?.toString().trim()) return;
		const actions = current();
		if (!actions.length) return;
		event.preventDefault();
		event.stopPropagation();
		// Keyboard-invoked menus report no pointer position: anchor to the element.
		const fromKeyboard = event.button !== 2 && event.clientX === 0 && event.clientY === 0;
		const rect = node.getBoundingClientRect();
		const anchor = fromKeyboard
			? { x: rect.left + 8, y: rect.bottom }
			: { x: event.clientX, y: event.clientY };
		const focused = document.activeElement instanceof HTMLElement ? document.activeElement : node;
		contextMenu.show(anchor, actions, focused);
	}
	node.addEventListener('contextmenu', onContextMenu);
	return {
		update(next: ContextActionSource | undefined) {
			current = next;
		},
		destroy() {
			node.removeEventListener('contextmenu', onContextMenu);
		}
	};
}
