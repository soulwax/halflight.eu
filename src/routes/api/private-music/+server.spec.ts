import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	list: vi.fn(),
	totalBytes: vi.fn(),
	create: vi.fn(),
	put: vi.fn()
}));

vi.mock('#lib/server/private-music', () => ({
	dbPrivateMusicStore: {
		list: mocks.list,
		totalBytes: mocks.totalBytes,
		create: mocks.create
	},
	MAX_PRIVATE_MUSIC_TOTAL_BYTES: 512 * 1024 * 1024,
	parsePrivateMusicUpload: (value: FormDataEntryValue | null) =>
		value instanceof File
			? { success: true as const, file: value, fileName: value.name, contentType: value.type }
			: { success: false as const, reason: 'missing' as const }
}));

vi.mock('#lib/server/private-music-bucket', () => ({
	privateMusicBucket: { enabled: true, put: mocks.put, delete: vi.fn() }
}));

import { GET, POST } from './+server';

function event(request = new Request('https://syn.test/api/private-music'), admin = true) {
	return {
		locals: { user: { id: 'owner' }, isAdministrator: admin },
		request
	} as unknown as Parameters<typeof GET>[0];
}

describe('/api/private-music', () => {
	beforeEach(() => {
		mocks.list.mockReset();
		mocks.totalBytes.mockReset();
		mocks.create.mockReset();
		mocks.put.mockReset();
	});

	it('lists metadata and same-origin download URLs without object keys', async () => {
		mocks.list.mockResolvedValue([
			{
				id: 'file-1',
				fileName: 'demo.flac',
				contentType: 'audio/flac',
				sizeBytes: 42,
				createdAt: '2026-01-01T00:00:00.000Z'
			}
		]);
		const response = await GET(event());
		expect(await response.json()).toEqual({
			files: [
				{
					id: 'file-1',
					fileName: 'demo.flac',
					contentType: 'audio/flac',
					sizeBytes: 42,
					createdAt: '2026-01-01T00:00:00.000Z',
					downloadUrl: '/api/private-music/file-1'
				}
			]
		});
	});

	it('uploads a bounded owner file to the private bucket then persists its metadata', async () => {
		mocks.totalBytes.mockResolvedValue(0);
		mocks.put.mockResolvedValue(undefined);
		mocks.create.mockImplementation(async (file) => ({
			...file,
			createdAt: '2026-01-01T00:00:00.000Z'
		}));
		const form = new FormData();
		form.set('file', new File(['audio'], 'demo.flac', { type: 'audio/flac' }));
		const response = await POST(
			event(
				new Request('https://syn.test/api/private-music', { method: 'POST', body: form })
			) as never
		);
		expect(response.status).toBe(201);
		expect(mocks.put).toHaveBeenCalledWith(
			expect.stringMatching(/^halflight-private-music\/v1\//),
			expect.any(Uint8Array),
			'audio/flac'
		);
		expect(mocks.create).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'owner', fileName: 'demo.flac' })
		);
	});

	it('does not expose private music to a non-owner', async () => {
		await expect(GET(event(undefined, false))).rejects.toMatchObject({ status: 401 });
		expect(mocks.list).not.toHaveBeenCalled();
	});
});
