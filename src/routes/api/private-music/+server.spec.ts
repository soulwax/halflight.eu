import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	list: vi.fn(),
	totalBytes: vi.fn(),
	create: vi.fn(),
	inspect: vi.fn(),
	put: vi.fn(),
	formats: [
		{ label: 'MP3', contentType: 'audio/mpeg', extensions: ['mp3'] },
		{ label: 'FLAC', contentType: 'audio/flac', extensions: ['flac'] },
		{ label: 'AAC', contentType: 'audio/aac', extensions: ['aac'] },
		{ label: 'M4A', contentType: 'audio/mp4', extensions: ['m4a', 'mp4'] },
		{ label: 'Ogg', contentType: 'audio/ogg', extensions: ['ogg', 'oga'] },
		{ label: 'WAV', contentType: 'audio/wav', extensions: ['wav'] },
		{ label: 'WebM', contentType: 'audio/webm', extensions: ['webm'] }
	]
}));

vi.mock('#lib/server/private-music', () => ({
	dbPrivateMusicStore: {
		list: mocks.list,
		totalBytes: mocks.totalBytes,
		create: mocks.create
	},
	MAX_PRIVATE_MUSIC_FILE_BYTES: 128 * 1024 * 1024,
	MAX_PRIVATE_MUSIC_TOTAL_BYTES: 512 * 1024 * 1024,
	PRIVATE_MUSIC_FORMATS: mocks.formats,
	parsePrivateMusicUpload: (value: FormDataEntryValue | null) =>
		value instanceof File
			? { success: true as const, upload: { file: value, fileName: value.name } }
			: { success: false as const, reason: 'missing' as const },
	inspectPrivateMusicUpload: mocks.inspect
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
		mocks.inspect.mockReset();
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
			formats: mocks.formats,
			storage: {
				fileCount: 1,
				usedBytes: 42,
				availableBytes: 512 * 1024 * 1024 - 42,
				maxTotalBytes: 512 * 1024 * 1024,
				maxFileBytes: 128 * 1024 * 1024
			},
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
		mocks.inspect.mockResolvedValue({
			success: true,
			bytes: Uint8Array.from([1, 2, 3]),
			contentType: 'audio/flac'
		});
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
			Uint8Array.from([1, 2, 3]),
			'audio/flac'
		);
		expect(mocks.create).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'owner', fileName: 'demo.flac' })
		);
		expect(await response.json()).toMatchObject({
			createdAt: '2026-01-01T00:00:00.000Z',
			downloadUrl: expect.stringMatching(/^\/api\/private-music\//)
		});
	});

	it('rejects files that fail byte inspection without writing to storage', async () => {
		mocks.totalBytes.mockResolvedValue(0);
		mocks.inspect.mockResolvedValue({ success: false, reason: 'type' });
		const form = new FormData();
		form.set('file', new File(['not audio'], 'notes.txt', { type: 'text/plain' }));

		await expect(
			POST(
				event(
					new Request('https://syn.test/api/private-music', { method: 'POST', body: form })
				) as never
			)
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.put).not.toHaveBeenCalled();
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it('does not expose private music to a non-owner', async () => {
		await expect(GET(event(undefined, false))).rejects.toMatchObject({ status: 401 });
		expect(mocks.list).not.toHaveBeenCalled();
	});
});
