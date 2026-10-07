import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rows: vi.fn(), changed: vi.fn(), set: vi.fn() }));
vi.mock('#lib/server/db', () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: mocks.rows }) }) }),
		update: () => ({
			set: (values: unknown) => {
				mocks.set(values);
				return { where: () => ({ returning: mocks.changed }) };
			}
		})
	}
}));
import { replaceSavedRecording } from './replace-recording';
const version = '2026-10-07T00:00:00.000Z';
beforeEach(() => {
	vi.clearAllMocks();
	mocks.rows.mockResolvedValue([
		{
			id: 'p',
			updatedAt: new Date(version),
			itemsJson: JSON.stringify([{ id: '1' }, { id: '3' }, { id: '1' }])
		}
	]);
	mocks.changed.mockResolvedValue([{ id: 'p' }]);
});
describe('atomic local playlist replacement', () => {
	it('preserves order and duplicates and stores the original recording ID', async () => {
		expect(
			await replaceSavedRecording(
				'owner',
				'p',
				'1',
				{ kind: 'track', id: '2', title: 'New', artists: [] },
				version
			)
		).toBe('updated');
		const items = JSON.parse(mocks.set.mock.calls[0][0].itemsJson);
		expect(items.map((track: { id: string }) => track.id)).toEqual(['2', '3', '2']);
		expect(items[0].replacementForId).toBe('1');
	});
	it('does not overwrite a playlist changed since the offer was shown', async () => {
		expect(
			await replaceSavedRecording(
				'owner',
				'p',
				'1',
				{ kind: 'track', id: '2', title: 'New', artists: [] },
				'older'
			)
		).toBe('conflict');
		expect(mocks.set).not.toHaveBeenCalled();
	});
	it('reports a concurrent change between reading and writing', async () => {
		mocks.changed.mockResolvedValue([]);
		expect(
			await replaceSavedRecording(
				'owner',
				'p',
				'1',
				{ kind: 'track', id: '2', title: 'New', artists: [] },
				version
			)
		).toBe('conflict');
	});
});
