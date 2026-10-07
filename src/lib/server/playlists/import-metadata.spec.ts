import { describe, expect, it, vi } from 'vitest';
import { resolveImportMetadata } from './import-metadata';
import type { Document, Resource } from '#lib/server/tidal/jsonapi';

const source: Document<Resource> = {
	data: {
		id: 'playlist',
		type: 'playlists',
		attributes: { title: 'Source', numberOfItems: 3 },
		relationships: {
			items: {
				data: [
					{ id: '1', type: 'tracks' },
					{ id: '2', type: 'tracks' },
					{ id: '1', type: 'tracks' }
				]
			}
		}
	},
	included: [{ id: '1', type: 'tracks', attributes: { title: 'Old title' } }]
};

describe('import recording metadata', () => {
	it('repairs unresolved metadata by exact ID, preserving order and duplicate recordings', async () => {
		const read = vi.fn(async (id: string) => ({
			data: {
				id,
				type: 'tracks',
				attributes: { title: `Canonical ${id}`, artists: [{ id: 'artist', name: 'Artist' }] }
			}
		}));
		const playlist = await resolveImportMetadata(source, {}, read);
		expect(playlist.items.map(({ id, title }) => [id, title])).toEqual([
			['1', 'Canonical 1'],
			['2', 'Canonical 2'],
			['1', 'Canonical 1']
		]);
		expect(read).toHaveBeenCalledTimes(2);
		expect(read).toHaveBeenCalledWith('2', { include: ['artists', 'albums'] }, {});
	});
	it('rejects metadata for a different recording instead of matching by title', async () => {
		const read = vi.fn(async () => ({
			data: { id: '99', type: 'tracks', attributes: { title: 'Same title' } }
		}));
		await expect(resolveImportMetadata(source, {}, read)).rejects.toThrow('did not match its ID');
	});
	it('does not return a partial successful playlist after a provider failure', async () => {
		const read = vi.fn().mockRejectedValue(new Error('Temporary provider failure'));
		await expect(resolveImportMetadata(source, {}, read)).rejects.toThrow(
			'Temporary provider failure'
		);
	});
});
