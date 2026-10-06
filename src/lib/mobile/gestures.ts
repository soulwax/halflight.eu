/**
 * Pure gesture maths for the full-screen Now Playing artwork.
 *
 * Swipes are an enhancement only: every action they trigger (next, previous,
 * close) also exists as a labelled, keyboard-operable control on the screen.
 */

export type DragAxis = 'x' | 'y';
export type ArtworkSwipe = 'next' | 'previous' | 'close';

export interface SwipeSample {
	/** Horizontal travel in px (positive = rightwards). */
	dx: number;
	/** Vertical travel in px (positive = downwards). */
	dy: number;
	/** Gesture duration in ms. */
	durationMs: number;
}

/** Travel before a drag commits to an axis. */
export const AXIS_LOCK_PX = 8;
/** Horizontal travel that changes track regardless of speed. */
export const TRACK_SWIPE_PX = 72;
/** Downward travel that closes the player regardless of speed. */
export const CLOSE_SWIPE_PX = 110;
/** A flick this fast (px/ms) commits with less travel. */
export const FLICK_VELOCITY = 0.5;
/** Minimum travel for a flick, so a jittery tap never counts. */
export const FLICK_MIN_PX = 28;

/**
 * Commits a drag to one axis once it has travelled far enough, so a mostly
 * vertical drag never also nudges the track horizontally (and vice versa).
 */
export function lockDragAxis(dx: number, dy: number): DragAxis | null {
	const ax = Math.abs(dx);
	const ay = Math.abs(dy);
	if (Math.max(ax, ay) < AXIS_LOCK_PX) return null;
	return ax > ay ? 'x' : 'y';
}

/**
 * Rubber-band damping: follows the finger closely at first, then resists,
 * approaching but never exceeding `limit`.
 */
export function dampDrag(delta: number, limit = 140): number {
	if (!Number.isFinite(delta) || delta === 0 || limit <= 0) return 0;
	return Math.sign(delta) * limit * (1 - Math.exp(-Math.abs(delta) / limit));
}

/** Resolves a finished artwork drag into an action, or `null` to spring back. */
export function resolveArtworkSwipe(
	{ dx, dy, durationMs }: SwipeSample,
	axis: DragAxis | null
): ArtworkSwipe | null {
	if (!axis) return null;
	const elapsed = Math.max(1, durationMs);

	if (axis === 'x') {
		const travel = Math.abs(dx);
		const flick = travel >= FLICK_MIN_PX && travel / elapsed >= FLICK_VELOCITY;
		if (travel < TRACK_SWIPE_PX && !flick) return null;
		return dx < 0 ? 'next' : 'previous';
	}

	if (dy <= 0) return null;
	const flick = dy >= FLICK_MIN_PX && dy / elapsed >= FLICK_VELOCITY;
	return dy >= CLOSE_SWIPE_PX || flick ? 'close' : null;
}

/** Damping limit when dragging towards a side with nothing to go to. */
export const EDGE_DRAG_PX = 36;

/**
 * Whether a drag has travelled far enough that releasing it now would commit,
 * ignoring speed — used to give one haptic tick as the threshold is crossed.
 */
export function swipeWouldCommit(dx: number, dy: number, axis: DragAxis | null): boolean {
	if (axis === 'x') return Math.abs(dx) >= TRACK_SWIPE_PX;
	if (axis === 'y') return dy >= CLOSE_SWIPE_PX;
	return false;
}

export type TrackStep = 'next' | 'previous';

/** What the player looked like before the current track changed. */
export interface TrackStepSnapshot {
	trackId: string | null;
	/** Track ids still waiting in the queue, in order. */
	upcomingIds: readonly string[];
	/** The most recent history entry: where "previous" would return to. */
	previousId: string | null;
}

/**
 * Infers which way playback moved, so the new artwork can slide in from the
 * matching side whether the change came from a swipe, a button, or the queue.
 * Returns `null` when the change is not a step (a fresh play, a repeat loop).
 */
export function inferTrackStep(
	before: TrackStepSnapshot,
	trackId: string | null
): TrackStep | null {
	if (!trackId || !before.trackId || trackId === before.trackId) return null;
	if (trackId === before.previousId) return 'previous';
	if (before.upcomingIds.includes(trackId)) return 'next';
	return null;
}
