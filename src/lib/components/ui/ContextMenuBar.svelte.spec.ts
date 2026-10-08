import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { Link, Play, Radio } from '@lucide/svelte';
import ContextMenuBar from './ContextMenuBar.svelte';
import {
	contextActions,
	contextMenu,
	type ContextAction
} from '#lib/context-menu/context-menu.svelte';
import { ACTION_SIZE } from '#lib/context-menu/placement';

vi.mock('$app/navigation', () => ({ afterNavigate: () => {}, goto: vi.fn() }));

function actions(onPlay = vi.fn()): ContextAction[] {
	return [
		{ id: 'play', label: 'Play now', icon: Play, onSelect: onPlay },
		{ id: 'radio', label: 'Start radio', icon: Radio, onSelect: vi.fn(), disabled: true },
		{ id: 'link', label: 'Copy link', icon: Link, onSelect: vi.fn() }
	];
}

afterEach(() => contextMenu.close());

describe('ContextMenuBar', () => {
	it('shows each action as a labelled 32px symbol and runs the chosen one', async () => {
		const onPlay = vi.fn();
		render(ContextMenuBar);
		contextMenu.show({ x: 40, y: 40 }, actions(onPlay), null);

		const play = page.getByRole('menuitem', { name: 'Play now' });
		await expect.element(play).toBeInTheDocument();
		// Layout size, unaffected by the brief scale-in animation.
		const button = play.element() as HTMLElement;
		expect(button.offsetWidth).toBe(ACTION_SIZE);
		expect(button.offsetHeight).toBe(ACTION_SIZE);
		expect(play.element().textContent?.trim()).toBe('');
		await expect.element(page.getByRole('menuitem', { name: 'Start radio' })).toBeDisabled();

		await play.click();
		expect(onPlay).toHaveBeenCalledOnce();
		expect(contextMenu.open).toBe(false);
	});

	it('reverses the pivot to grow up and left in the bottom-right corner', async () => {
		render(ContextMenuBar);
		contextMenu.show({ x: window.innerWidth - 2, y: window.innerHeight - 2 }, actions(), null);
		await expect.element(page.getByRole('menu')).toBeInTheDocument();
		const bar = page.getByRole('menu').element() as HTMLElement;
		expect(bar.offsetLeft + bar.offsetWidth).toBeLessThanOrEqual(window.innerWidth - 2);
		expect(bar.offsetTop + bar.offsetHeight).toBeLessThanOrEqual(window.innerHeight - 2);
		expect(bar.classList.contains('flip-x')).toBe(true);
		expect(bar.classList.contains('flip-y')).toBe(true);
	});

	it('moves focus with the arrow keys, skipping disabled actions, and closes on Escape', async () => {
		render(ContextMenuBar);
		const trigger = document.createElement('button');
		document.body.append(trigger);
		trigger.focus();
		contextMenu.show({ x: 40, y: 40 }, actions(), trigger);

		await expect.element(page.getByRole('menuitem', { name: 'Play now' })).toHaveFocus();
		await userEvent.keyboard('{ArrowRight}');
		await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).toHaveFocus();
		await userEvent.keyboard('{Escape}');
		expect(contextMenu.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
		trigger.remove();
	});
});

describe('contextActions', () => {
	function host(source = () => actions()) {
		const node = document.createElement('div');
		document.body.append(node);
		const handle = contextActions(node, source);
		return {
			node,
			fire(init: MouseEventInit & { pointerType?: string } = {}) {
				const event = new PointerEvent('contextmenu', {
					bubbles: true,
					cancelable: true,
					button: 2,
					clientX: 100,
					clientY: 120,
					...init
				});
				node.dispatchEvent(event);
				return event;
			},
			cleanup() {
				handle.destroy();
				node.remove();
			}
		};
	}

	it('opens the bar at the pointer instead of the browser menu', () => {
		const target = host();
		const event = target.fire();
		expect(event.defaultPrevented).toBe(true);
		expect(contextMenu.open).toBe(true);
		expect(contextMenu.anchor).toEqual({ x: 100, y: 120 });
		target.cleanup();
	});

	it('keeps the browser menu for Shift+right-click and editable fields', () => {
		const target = host();
		expect(target.fire({ shiftKey: true }).defaultPrevented).toBe(false);
		const input = document.createElement('input');
		target.node.append(input);
		const event = new PointerEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
		input.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
		expect(contextMenu.open).toBe(false);
		target.cleanup();
	});

	it('leaves touch long-presses to dragging and the action sheet', () => {
		const target = host();
		expect(target.fire({ pointerType: 'touch' }).defaultPrevented).toBe(false);
		expect(contextMenu.open).toBe(false);
		target.cleanup();
	});

	it('anchors a keyboard-invoked menu to the element', () => {
		const target = host();
		target.node.style.cssText = 'position:fixed;left:50px;top:60px;width:100px;height:20px';
		target.fire({ button: 0, clientX: 0, clientY: 0 });
		expect(contextMenu.anchor).toEqual({ x: 58, y: 80 });
		target.cleanup();
	});
});
