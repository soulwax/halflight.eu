import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	list: vi.fn(),
	put: vi.fn()
}));

vi.mock('#lib/server/private-music', () => ({
	dbPrivateMusicStore: { list: mocks.list }
}));
vi.mock('#lib/server/export-bucket', () => ({
	exportBucket: { enabled: true, put: mocks.put }
}));

import { GET, POST } from './+server';

function event(request = new Request('https://syn.test/api/private-music/export'), admin = true) {
	return {
		locals: { user: { id: 'owner' }, isAdministrator: admin },
		request
	} as unknown as Parameters<typeof GET>[0];
}

const file = {
	id: 'file-1',
	userId: 'owner',
	objectKey: 'halflight-private-music/v1/123e4567-e89b-12d3-a456-426614174000',
	fileName: 'demo.flac',
	contentType: 'audio/flac',
	sizeBytes: 42,
	createdAt: '2026-01-01T00:00:00.000Z'
};

describe('/api/private-music/export', () => {
	beforeEach(() => {
		mocks.list.mockReset();
		mocks.put.mockReset();
	});

	it('creates a same-origin M3U manifest without object keys', async () => {
		mocks.list.mockResolvedValue([file]);
		const response = await GET(event());
		const content = await response.text();
		expect(response.headers.get('Content-Type')).toContain('audio/x-mpegurl');
		expect(content).toContain('https://syn.test/api/private-music/file-1');
		expect(content).not.toContain(file.objectKey);
	});

	it('stores a short-lived JSON manifest through the export bucket', async () => {
		mocks.list.mockResolvedValue([file]);
		mocks.put.mockResolvedValue({
			id: '1234567890123-123e4567-e89b-12d3-a456-426614174000.json',
			expiresAt: '2026-01-01T00:15:00.000Z'
		});
		const response = await POST(
			event(
				new Request('https://syn.test/api/private-music/export?format=json', { method: 'POST' })
			)
		);
		expect(response.status).toBe(201);
		expect(mocks.put).toHaveBeenCalledWith(
			expect.objectContaining({
				format: 'json',
				fileName: 'syn-private-music.json'
			})
		);
		expect(await response.json()).toEqual({
			id: '1234567890123-123e4567-e89b-12d3-a456-426614174000.json',
			expiresAt: '2026-01-01T00:15:00.000Z',
			downloadUrl: '/api/exports/1234567890123-123e4567-e89b-12d3-a456-426614174000.json'
		});
	});

	it('keeps manifests restricted to the owner', async () => {
		await expect(GET(event(undefined, false))).rejects.toMatchObject({ status: 401 });
		expect(mocks.list).not.toHaveBeenCalled();
	});
});
