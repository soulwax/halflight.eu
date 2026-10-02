import { afterEach, describe, expect, it, vi } from 'vitest';
import { playlistWorkResponse } from './response';

afterEach(() => vi.useRealTimers());

describe('playlist validation response', () => {
	it('keeps long checks active and emits parseable JSON only when complete', async () => {
		vi.useFakeTimers();
		let complete!: (result: unknown) => void;
		const response = playlistWorkResponse(() => new Promise((resolve) => (complete = resolve)));
		const reader = response.body!.getReader();
		const decoder = new TextDecoder();
		let text = decoder.decode((await reader.read()).value);
		await vi.advanceTimersByTimeAsync(75_000);
		for (let i = 0; i < 5; i++) text += decoder.decode((await reader.read()).value);
		expect(text.trim()).toBe('');
		complete({ totalImported: 1, streamValidation: 'verified' });
		text += decoder.decode((await reader.read()).value);
		expect(JSON.parse(text)).toEqual({ totalImported: 1, streamValidation: 'verified' });
		expect((await reader.read()).done).toBe(true);
		await vi.advanceTimersByTimeAsync(0);
		expect(vi.getTimerCount()).toBe(0);
		expect(response.headers.get('X-Accel-Buffering')).toBe('no');
	});
	it('clears keepalives when the reader disconnects, even with work still pending', async () => {
		vi.useFakeTimers();
		let complete!: (result: unknown) => void;
		const response = playlistWorkResponse(() => new Promise((resolve) => (complete = resolve)));
		const reader = response.body!.getReader();
		await reader.read();
		await reader.cancel();
		complete({ totalImported: 1 });
		await vi.advanceTimersByTimeAsync(30_000);
		expect(vi.getTimerCount()).toBe(0);
		expect((await reader.read()).done).toBe(true);
	});
	it('does not serialize an unexpected error or leave the keepalive running', async () => {
		vi.useFakeTimers();
		const response = playlistWorkResponse(() =>
			Promise.reject(new Error('private provider details'))
		);
		await expect(response.json()).rejects.toThrow('Playlist operation failed');
		await vi.advanceTimersByTimeAsync(0);
		expect(vi.getTimerCount()).toBe(0);
	});
});
