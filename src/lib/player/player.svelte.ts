import type { TrackSummary } from '#lib/server/tidal/models';

export class PlayerState {
	currentTrack = $state<TrackSummary | null>(null);
	queue = $state<TrackSummary[]>([]);
	history = $state<TrackSummary[]>([]);
	isQueueOpen = $state(false);
	isExpanded = $state(false);

	hasNext = $derived(this.queue.length > 0);
	hasPrevious = $derived(this.history.length > 0);
	queueCount = $derived(this.queue.length);

	play(track: TrackSummary, contextTracks?: TrackSummary[]): void {
		if (this.currentTrack && this.currentTrack.id !== track.id) {
			this.history.push(this.currentTrack);
		}
		this.currentTrack = track;

		if (contextTracks && contextTracks.length > 0) {
			const trackIndex = contextTracks.findIndex((t) => t.id === track.id);
			if (trackIndex !== -1) {
				this.queue = contextTracks.slice(trackIndex + 1);
			} else {
				this.queue = [...contextTracks];
			}
		}
	}

	addToQueue(track: TrackSummary): void {
		this.queue.push(track);
	}

	addMultipleToQueue(tracks: TrackSummary[]): void {
		this.queue.push(...tracks);
	}

	removeFromQueue(index: number): void {
		if (index >= 0 && index < this.queue.length) {
			this.queue.splice(index, 1);
		}
	}

	clearQueue(): void {
		this.queue = [];
	}

	next(): TrackSummary | null {
		if (this.queue.length === 0) return null;
		if (this.currentTrack) {
			this.history.push(this.currentTrack);
		}
		const nextTrack = this.queue.shift()!;
		this.currentTrack = nextTrack;
		return nextTrack;
	}

	previous(): TrackSummary | null {
		if (this.history.length === 0) return null;
		const prevTrack = this.history.pop()!;
		if (this.currentTrack) {
			this.queue.unshift(this.currentTrack);
		}
		this.currentTrack = prevTrack;
		return prevTrack;
	}

	playFromQueue(index: number): void {
		if (index < 0 || index >= this.queue.length) return;
		if (this.currentTrack) {
			this.history.push(this.currentTrack);
		}
		const [targetTrack] = this.queue.splice(index, 1);
		this.currentTrack = targetTrack;
	}

	toggleQueue(): void {
		this.isQueueOpen = !this.isQueueOpen;
	}

	closeQueue(): void {
		this.isQueueOpen = false;
	}

	toggleExpanded(): void {
		this.isExpanded = !this.isExpanded;
	}

	close(): void {
		this.currentTrack = null;
		this.queue = [];
		this.history = [];
		this.isQueueOpen = false;
	}
}

export const player = new PlayerState();
