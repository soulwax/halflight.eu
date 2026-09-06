import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	get: vi.fn(),
	deleteMetadata: vi.fn(),
	getObject: vi.fn(),
	deleteObject: vi.fn()
}));

vi.mock('#lib/server/private-music', () => ({
	dbPrivateMusicStore: { get: mocks.get, delete: mocks.deleteMetadata }
}));
vi.mock('#lib/server/private-music-bucket', () => ({
	privateMusicBucket: { get: mocks.getObject, delete: mocks.deleteObject }
}));

import { DELETE, GET } from './+server';

function event() {
	return {
		locals: { user: { id: 'owner' }, isAdministrator: true },
		params: { id: 'file-1' }
	} as unknown as Parameters<typeof GET>[0];
}

const file = {
	id: 'file-1',
	objectKey: 'halflight-private-music/v1/123e4567-e89b-12d3-a456-426614174000',
	fileName: 'demo.flac',
	contentType: 'audio/flac',
	sizeBytes: 5
};

describe('/api/private-music/[id]', () => {
	beforeEach(() => {
		mocks.get.mockReset();
		mocks.deleteMetadata.mockReset();
		mocks.getObject.mockReset();
		mocks.deleteObject.mockReset();
	});

	it('streams a private file through Syn', async () => {
		mocks.get.mockResolvedValue(file);
		mocks.getObject.mockResolvedValue(
			new ReadableStream({
				start(c) {
					c.enqueue(new TextEncoder().encode('audio'));
					c.close();
				}
			})
		);
		const response = await GET(event());
		expect(response.headers.get('Content-Disposition')).toContain('demo.flac');
		expect(await response.text()).toBe('audio');
	});

	it('deletes bytes before removing the owner metadata', async () => {
		mocks.get.mockResolvedValue(file);
		mocks.deleteMetadata.mockResolvedValue(file);
		const response = await DELETE(event());
		expect(await response.json()).toEqual({ deleted: true });
		expect(mocks.deleteObject).toHaveBeenCalledWith(file.objectKey);
		expect(mocks.deleteMetadata).toHaveBeenCalledWith('owner', 'file-1');
	});
});
