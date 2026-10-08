import { describe, expect, it, vi } from 'vitest';
import { handlePlayerKeydown, type ShortcutActions } from './shortcuts.js';

function createMockActions(hasTrack = true): ShortcutActions {
	return {
		hasTrack,
		togglePlayPause: vi.fn(),
		seekBy: vi.fn(),
		adjustVolume: vi.fn(),
		setVolume: vi.fn(),
		toggleMute: vi.fn(),
		next: vi.fn(),
		previous: vi.fn(),
		togglePanel: vi.fn(),
		toggleDock: vi.fn()
	};
}

function mockKeyEvent(init: {
	code: string;
	shiftKey?: boolean;
	altKey?: boolean;
	ctrlKey?: boolean;
	metaKey?: boolean;
	target?: EventTarget | null;
}): KeyboardEvent {
	return {
		code: init.code,
		shiftKey: init.shiftKey ?? false,
		altKey: init.altKey ?? false,
		ctrlKey: init.ctrlKey ?? false,
		metaKey: init.metaKey ?? false,
		target: init.target ?? null,
		preventDefault: vi.fn()
	} as unknown as KeyboardEvent;
}

describe('shortcuts.ts', () => {
	it('handles Space and k to toggle play/pause when a track is active', () => {
		const actions = createMockActions(true);

		const spaceEvent = mockKeyEvent({ code: 'Space' });
		const handledSpace = handlePlayerKeydown(spaceEvent, actions);
		expect(handledSpace).toBe(true);
		expect(actions.togglePlayPause).toHaveBeenCalledOnce();

		const kEvent = mockKeyEvent({ code: 'KeyK' });
		const handledK = handlePlayerKeydown(kEvent, actions);
		expect(handledK).toBe(true);
		expect(actions.togglePlayPause).toHaveBeenCalledTimes(2);
	});

	it('ignores Space and playback shortcuts when no track is active', () => {
		const actions = createMockActions(false);

		const spaceEvent = mockKeyEvent({ code: 'Space' });
		const handled = handlePlayerKeydown(spaceEvent, actions);
		expect(handled).toBe(false);
		expect(actions.togglePlayPause).not.toHaveBeenCalled();
	});

	it('handles scrubbing with j/l and ArrowLeft/ArrowRight', () => {
		const actions = createMockActions(true);

		handlePlayerKeydown(mockKeyEvent({ code: 'KeyJ' }), actions);
		expect(actions.seekBy).toHaveBeenCalledWith(-10);

		handlePlayerKeydown(mockKeyEvent({ code: 'KeyL' }), actions);
		expect(actions.seekBy).toHaveBeenCalledWith(10);

		handlePlayerKeydown(mockKeyEvent({ code: 'ArrowLeft' }), actions);
		expect(actions.seekBy).toHaveBeenCalledWith(-5);

		handlePlayerKeydown(mockKeyEvent({ code: 'ArrowRight', shiftKey: true }), actions);
		expect(actions.seekBy).toHaveBeenCalledWith(15);
	});

	it('handles track navigation and panel toggles', () => {
		const actions = createMockActions(true);

		handlePlayerKeydown(mockKeyEvent({ code: 'KeyN' }), actions);
		expect(actions.next).toHaveBeenCalledOnce();

		handlePlayerKeydown(mockKeyEvent({ code: 'KeyP' }), actions);
		expect(actions.previous).toHaveBeenCalledOnce();

		handlePlayerKeydown(mockKeyEvent({ code: 'KeyM' }), actions);
		expect(actions.toggleMute).toHaveBeenCalledOnce();

		handlePlayerKeydown(mockKeyEvent({ code: 'KeyQ' }), actions);
		expect(actions.togglePanel).toHaveBeenCalledWith('queue');

		handlePlayerKeydown(mockKeyEvent({ code: 'KeyC' }), actions);
		expect(actions.togglePanel).toHaveBeenCalledWith('lyrics');

		handlePlayerKeydown(mockKeyEvent({ code: 'KeyD' }), actions);
		expect(actions.toggleDock).toHaveBeenCalledOnce();
	});
});
it('leaves handled keys and menu/dialog navigation to their own controls', () => {
	const actions = createMockActions();
	const prevented = {
		...mockKeyEvent({ code: 'ArrowUp' }),
		defaultPrevented: true
	} as KeyboardEvent;
	expect(handlePlayerKeydown(prevented, actions)).toBe(false);
	const target = { closest: () => ({}) } as unknown as EventTarget;
	expect(handlePlayerKeydown(mockKeyEvent({ code: 'ArrowRight', target }), actions)).toBe(false);
	expect(actions.adjustVolume).not.toHaveBeenCalled();
	expect(actions.seekBy).not.toHaveBeenCalled();
});
