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

import { DELETE, GET, HEAD } from './+server';

function event(request = new Request('https://syn.test/api/private-music/file-1')) {
	return {
		locals: { user: { id: 'owner' }, isAdministrator: true },
		params: { id: 'file-1' },
		request
	} as unknown as Parameters<typeof GET>[0];
}

const file = {
	id: 'file-1',
	objectKey: 'halflight-private-music/v1/123e4567-e89b-12d3-a456-426614174000',
	fileName: 'demo.flac',
	contentType: 'audio/flac',
	sizeBytes: 5,
	createdAt: '2026-01-01T00:00:00.000Z'
};

describe('/api/private-music/[id]', () => {
	beforeEach(() => {
		mocks.get.mockReset();
		mocks.deleteMetadata.mockReset();
		mocks.getObject.mockReset();
		mocks.deleteObject.mockReset();
	});

	it('streams a private file inline through Syn', async () => {
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
		expect(response.headers.get('Content-Disposition')).toBe(
			'inline; filename="demo.flac"; filename*=UTF-8\'\'demo.flac'
		);
		expect(response.headers.get('Accept-Ranges')).toBe('bytes');
		expect(await response.text()).toBe('audio');
	});

	it('turns an explicit download request into an attachment without exposing the bucket', async () => {
		mocks.get.mockResolvedValue({ ...file, fileName: 'Björk; demo.flac' });
		mocks.getObject.mockResolvedValue(new ReadableStream());
		const response = await GET(
			event(new Request('https://syn.test/api/private-music/file-1?download=1'))
		);
		expect(response.headers.get('Content-Disposition')).toBe(
			'attachment; filename="Bj_rk; demo.flac"; filename*=UTF-8\'\'Bj%C3%B6rk%3B%20demo.flac'
		);
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('serves valid byte ranges without disclosing the object location', async () => {
		mocks.get.mockResolvedValue(file);
		mocks.getObject.mockResolvedValue(new ReadableStream());
		const response = await GET(
			event(
				new Request('https://syn.test/api/private-music/file-1', {
					headers: { Range: 'bytes=1-3' }
				})
			)
		);
		expect(response.status).toBe(206);
		expect(response.headers.get('Content-Range')).toBe('bytes 1-3/5');
		expect(response.headers.get('Content-Length')).toBe('3');
		expect(mocks.getObject).toHaveBeenCalledWith(file.objectKey, 'bytes=1-3');
	});

	it('returns a cache validation response without reading private bytes', async () => {
		mocks.get.mockResolvedValue(file);
		const response = await GET(
			event(
				new Request('https://syn.test/api/private-music/file-1', {
					headers: { 'If-None-Match': '"file-1-5-1767225600000"' }
				})
			)
		);
		expect(response.status).toBe(304);
		expect(response.headers.get('ETag')).toBe('"file-1-5-1767225600000"');
		expect(mocks.getObject).not.toHaveBeenCalled();
	});

	it('falls back to a full response when an If-Range validator is stale', async () => {
		mocks.get.mockResolvedValue(file);
		mocks.getObject.mockResolvedValue(new ReadableStream());
		const response = await GET(
			event(
				new Request('https://syn.test/api/private-music/file-1', {
					headers: { Range: 'bytes=1-3', 'If-Range': '"stale"' }
				})
			)
		);
		expect(response.status).toBe(200);
		expect(mocks.getObject).toHaveBeenCalledWith(file.objectKey, undefined);
	});

	it('rejects invalid byte ranges before reading from storage', async () => {
		mocks.get.mockResolvedValue(file);
		const response = await GET(
			event(
				new Request('https://syn.test/api/private-music/file-1', { headers: { Range: 'bytes=9-' } })
			)
		);
		expect(response.status).toBe(416);
		expect(response.headers.get('Content-Range')).toBe('bytes */5');
		expect(mocks.getObject).not.toHaveBeenCalled();
	});

	it('responds to metadata probes without reading bytes from storage', async () => {
		mocks.get.mockResolvedValue(file);
		const response = await HEAD(
			event(new Request('https://syn.test/api/private-music/file-1', { method: 'HEAD' }))
		);
		expect(response.headers.get('Content-Length')).toBe('5');
		expect(response.headers.get('Accept-Ranges')).toBe('bytes');
		expect(response.headers.get('ETag')).toBe('"file-1-5-1767225600000"');
		expect(mocks.getObject).not.toHaveBeenCalled();
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
