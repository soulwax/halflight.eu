import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveSearchScheduler } from './live-search';

describe('fresh-input search scheduling', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('searches the latest input at three seconds even during continuous typing', () => {
		const scheduler = new LiveSearchScheduler();
		const first = vi.fn();
		const latest = vi.fn();
		scheduler.schedule(first);
		vi.advanceTimersByTime(2_000);
		scheduler.cancel(true);
		scheduler.schedule(latest);
		vi.advanceTimersByTime(999);
		expect(latest).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(latest).toHaveBeenCalledOnce();
		expect(first).not.toHaveBeenCalled();
		vi.advanceTimersByTime(30_000);
		expect(latest).toHaveBeenCalledOnce();
	});

	it('starts another window only when fresh input arrives', () => {
		const scheduler = new LiveSearchScheduler();
		const search = vi.fn();
		scheduler.schedule(search);
		vi.advanceTimersByTime(3_000);
		scheduler.schedule(search);
		vi.advanceTimersByTime(2_999);
		expect(search).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(1);
		expect(search).toHaveBeenCalledTimes(2);
	});

	it('cancels a pending search when cleared or unmounted', () => {
		const scheduler = new LiveSearchScheduler();
		const search = vi.fn();
		scheduler.schedule(search);
		scheduler.cancel();
		vi.advanceTimersByTime(5_000);
		expect(search).not.toHaveBeenCalled();
		scheduler.schedule(search);
		vi.advanceTimersByTime(2_999);
		expect(search).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(search).toHaveBeenCalledOnce();
	});
});
