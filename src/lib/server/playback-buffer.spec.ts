import { describe, expect, it, vi } from 'vitest';
import {
	applyBufferedPlaybackIntent,
	recoverBufferedPlayback,
	type PlaybackBuffer
} from './playback-buffer';
import type { PlaybackIntent } from './playback-state';

vi.mock('$app/env/private', () => ({ REDIS_CACHE: undefined }));
vi.mock('#lib/server/db', () => ({ db: {} }));

const intent: PlaybackIntent = {
	version: 2,
	expectedRevision: 0,
	operationId: 'operation_buffer_test',
	origin: 'listening-room',
	intent: { type: 'queue.clear' }
};
const state = {
	currentTrack: null,
	queue: [],
	history: [],
	currentTime: 0,
	revision: 1,
	lastOrigin: null,
	activeDevice: null
};
const accepted = { state, conflict: false, duplicate: false };
function buffer(): PlaybackBuffer {
	return {
		list: vi.fn(async () => []),
		put: vi.fn(async () => true),
		remove: vi.fn(async () => {})
	};
}

describe('playback Redis buffer', () => {
	it('keeps database writes working when Redis is unavailable', async () => {
		const backup = buffer();
		vi.mocked(backup.list).mockRejectedValue(new Error('Redis unavailable'));
		vi.mocked(backup.remove).mockRejectedValue(new Error('Redis unavailable'));
		const apply = vi.fn(async () => accepted);
		expect(await applyBufferedPlaybackIntent('owner', intent, { buffer: backup, apply })).toEqual(
			accepted
		);
		expect(apply).toHaveBeenCalledWith('owner', intent);
		expect(backup.put).not.toHaveBeenCalled();
	});
	it('buffers a validated edit when its database write fails', async () => {
		const backup = buffer();
		const apply = vi.fn(async () => {
			throw new Error('Database unavailable');
		});
		expect(await applyBufferedPlaybackIntent('owner', intent, { buffer: backup, apply })).toEqual({
			buffered: true
		});
		expect(backup.put).toHaveBeenCalledWith('owner', intent);
	});
	it('preserves an honest failure when both server stores fail', async () => {
		const backup = buffer();
		vi.mocked(backup.put).mockRejectedValue(new Error('Redis unavailable'));
		const apply = vi.fn(async () => {
			throw new Error('Database unavailable');
		});
		await expect(
			applyBufferedPlaybackIntent('owner', intent, { buffer: backup, apply })
		).rejects.toThrow('Database unavailable');
	});
	it('replays buffered edits before new edits and rebases one stale revision', async () => {
		const backup = buffer();
		const older = { ...intent, operationId: 'operation_older' };
		vi.mocked(backup.list).mockResolvedValue([older]);
		const apply = vi
			.fn()
			.mockResolvedValueOnce({ ...accepted, conflict: true })
			.mockResolvedValue(accepted);
		await applyBufferedPlaybackIntent('owner', intent, { buffer: backup, apply });
		expect(apply.mock.calls.map(([, operation]) => operation.operationId)).toEqual([
			'operation_older',
			'operation_older',
			intent.operationId
		]);
		expect(apply.mock.calls[1][1].expectedRevision).toBe(1);
		expect(backup.remove).toHaveBeenCalledWith('owner', older.operationId);
	});
	it('keeps buffered edits when the database is still unavailable', async () => {
		const backup = buffer();
		vi.mocked(backup.list).mockResolvedValue([intent]);
		const apply = vi.fn(async () => {
			throw new Error('Database unavailable');
		});
		await expect(recoverBufferedPlayback('owner', { buffer: backup, apply })).rejects.toThrow();
		expect(backup.remove).not.toHaveBeenCalled();
	});
	it('allows safe replay after a lost Redis cleanup acknowledgement', async () => {
		const backup = buffer();
		vi.mocked(backup.list).mockResolvedValue([intent]);
		vi.mocked(backup.remove).mockRejectedValue(new Error('Lost acknowledgement'));
		const apply = vi.fn(async () => ({ ...accepted, duplicate: true }));
		await recoverBufferedPlayback('owner', { buffer: backup, apply });
		await recoverBufferedPlayback('owner', { buffer: backup, apply });
		expect(apply).toHaveBeenCalledTimes(2);
	});
});
