import { WebHaptics } from 'web-haptics';

const isBrowser = typeof window !== 'undefined';
let instance: WebHaptics | null = null;

function getInstance(): WebHaptics | null {
	if (!isBrowser) return null;
	if (!instance) {
		try {
			instance = new WebHaptics();
		} catch {
			instance = null;
		}
	}
	return instance;
}

export const haptics = {
	/** Soft tick on fine volume / seek adjustments */
	tick(): void {
		try {
			void getInstance()
				?.trigger('selection')
				.catch(() => {});
		} catch {
			// Best-effort haptic trigger
		}
	},
	/** Medium notch feedback when passing 100% reference level */
	notch(): void {
		try {
			void getInstance()
				?.trigger('medium')
				.catch(() => {});
		} catch {
			// Best-effort haptic trigger
		}
	},
	/** Boundary pulse when reaching 0% (mute) or 125% (max boost) */
	limit(): void {
		try {
			void getInstance()
				?.trigger('heavy')
				.catch(() => {});
		} catch {
			// Best-effort haptic trigger
		}
	},
	/** Snap / reset pulse (e.g. double click to reset to 100%) */
	snap(): void {
		try {
			void getInstance()
				?.trigger('success')
				.catch(() => {});
		} catch {
			// Best-effort haptic trigger
		}
	}
};
