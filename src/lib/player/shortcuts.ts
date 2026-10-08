export interface ShortcutActions {
	hasTrack: boolean;
	togglePlayPause: () => void;
	seekBy: (seconds: number) => void;
	adjustVolume: (delta: number) => void;
	setVolume: (vol: number) => void;
	toggleMute: () => void;
	next: () => void;
	previous: () => void;
	togglePanel: (panel: 'queue' | 'lyrics') => void;
	toggleDock: () => void;
}

function isEditable(target: EventTarget | null): boolean {
	if (!target) return false;
	const el = target as { tagName?: string; isContentEditable?: boolean };
	if (el.isContentEditable) return true;
	const tag = (el.tagName || '').toUpperCase();
	return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Global listening room keyboard dispatcher.
 * Handles Space, j/k/l scrubbing, arrow seek, volume increments, panel toggles,
 * while respecting text fields and active inputs.
 */
export function handlePlayerKeydown(event: KeyboardEvent, actions: ShortcutActions): boolean {
	if (event.defaultPrevented || isEditable(event.target)) return false;
	if ((event.target as HTMLElement | null)?.closest?.('[role="menu"], [role="dialog"]'))
		return false;
	if (event.metaKey || event.ctrlKey) return false;

	const target = event.target as {
		tagName?: string;
		getAttribute?: (attr: string) => string | null;
	} | null;
	const isButton = target && (target.tagName || '').toUpperCase() === 'BUTTON';

	switch (event.code) {
		case 'Space': {
			if (isButton) return false; // allow native button click
			if (!actions.hasTrack) return false;
			event.preventDefault();
			actions.togglePlayPause();
			return true;
		}
		case 'KeyK': {
			if (!actions.hasTrack) return false;
			event.preventDefault();
			actions.togglePlayPause();
			return true;
		}
		case 'KeyJ': {
			if (!actions.hasTrack) return false;
			event.preventDefault();
			actions.seekBy(-10);
			return true;
		}
		case 'KeyL': {
			if (!actions.hasTrack) return false;
			event.preventDefault();
			actions.seekBy(10);
			return true;
		}
		case 'KeyN': {
			event.preventDefault();
			actions.next();
			return true;
		}
		case 'KeyP': {
			event.preventDefault();
			actions.previous();
			return true;
		}
		case 'KeyM': {
			event.preventDefault();
			actions.toggleMute();
			return true;
		}
		case 'Digit0': {
			event.preventDefault();
			actions.setVolume(0);
			return true;
		}
		case 'Digit1': {
			event.preventDefault();
			actions.setVolume(1.0);
			return true;
		}
		case 'KeyQ': {
			event.preventDefault();
			actions.togglePanel('queue');
			return true;
		}
		case 'KeyC': {
			event.preventDefault();
			actions.togglePanel('lyrics');
			return true;
		}
		case 'KeyD': {
			event.preventDefault();
			actions.toggleDock();
			return true;
		}
		case 'ArrowLeft': {
			if (!actions.hasTrack) return false;
			if (target?.getAttribute?.('type') === 'range') return false; // native slider
			event.preventDefault();
			actions.seekBy(event.shiftKey ? -15 : -5);
			return true;
		}
		case 'ArrowRight': {
			if (!actions.hasTrack) return false;
			if (target?.getAttribute?.('type') === 'range') return false; // native slider
			event.preventDefault();
			actions.seekBy(event.shiftKey ? 15 : 5);
			return true;
		}
		case 'ArrowUp': {
			if (target?.getAttribute?.('type') === 'range') return false;
			if (event.shiftKey || event.altKey) {
				event.preventDefault();
				actions.adjustVolume(0.05);
				return true;
			}
			return false;
		}
		case 'ArrowDown': {
			if (target?.getAttribute?.('type') === 'range') return false;
			if (event.shiftKey || event.altKey) {
				event.preventDefault();
				actions.adjustVolume(-0.05);
				return true;
			}
			return false;
		}
		default:
			return false;
	}
}
