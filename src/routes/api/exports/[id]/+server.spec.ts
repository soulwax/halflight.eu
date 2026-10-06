import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	get: vi.fn(),
	delete: vi.fn()
}));

vi.mock('#lib/server/export-bucket', () => ({
	exportBucket: { enabled: true, get: mocks.get, delete: mocks.delete }
}));

import { DELETE, GET } from './+server';

function event(id = '1234567890123-123e4567-e89b-12d3-a456-426614174000.m3u8', admin = true) {
	return {
		locals: { user: { id: 'owner' }, isListener: admin },
		params: { id }
	} as unknown as Parameters<typeof GET>[0];
}

describe('/api/exports/[id]', () => {
	beforeEach(() => {
		mocks.get.mockReset();
		mocks.delete.mockReset();
	});

	it('streams an owner export through Syn without exposing a bucket URL', async () => {
		mocks.get.mockResolvedValue({
			body: new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode('#EXTM3U'));
					controller.close();
				}
			}),
			contentType: 'audio/x-mpegurl; charset=utf-8',
			contentDisposition: 'attachment; filename="set.m3u8"'
		});
		const response = await GET(event());
		expect(response.headers.get('Content-Disposition')).toContain('set.m3u8');
		expect(await response.text()).toBe('#EXTM3U');
	});

	it('requires the owner account', async () => {
		await expect(GET(event(undefined, false))).rejects.toMatchObject({ status: 401 });
		expect(mocks.get).not.toHaveBeenCalled();
	});

	it('deletes an export through the authenticated proxy', async () => {
		mocks.delete.mockResolvedValue(true);
		const response = await DELETE(event());
		expect(await response.json()).toEqual({ deleted: true });
	});

	it('only ever addresses the signed-in listeners own exports', async () => {
		mocks.get.mockResolvedValue(null);
		mocks.delete.mockResolvedValue(false);
		const id = '1234567890123-123e4567-e89b-12d3-a456-426614174000.m3u8';

		await Promise.resolve(GET(event())).catch(() => undefined);
		await DELETE(event());

		expect(mocks.get).toHaveBeenCalledWith('owner', id);
		expect(mocks.delete).toHaveBeenCalledWith('owner', id);
	});
});
