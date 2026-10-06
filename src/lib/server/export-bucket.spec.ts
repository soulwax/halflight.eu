import { describe, expect, it, vi } from 'vitest';
import { createExportBucket } from './export-bucket';

function configuredBucket(client?: { send(command: unknown): Promise<unknown> }) {
	return createExportBucket(
		{
			bucket: 'exports',
			endpoint: 'https://bucket.example.test',
			accessKeyId: 'key',
			secretAccessKey: 'secret'
		},
		client
	);
}

describe('export bucket', () => {
	it('remains disabled until a complete isolated bucket configuration is supplied', () => {
		expect(createExportBucket({ bucket: 'exports' }).enabled).toBe(false);
	});

	it('stores only an opaque, expiring export object', async () => {
		const send = vi.fn().mockResolvedValue({});
		const bucket = configuredBucket({ send });
		const stored = await bucket.put({
			userId: 'u1',
			content: new TextEncoder().encode('#EXTM3U'),
			contentType: 'audio/x-mpegurl; charset=utf-8',
			fileName: 'set.m3u8',
			format: 'm3u8'
		});

		expect(stored.id).toMatch(/^\d{13}-[0-9a-f-]{36}\.m3u8$/);
		expect(new Date(stored.expiresAt).getTime()).toBeGreaterThan(Date.now());
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				input: expect.objectContaining({
					Bucket: 'exports',
					Key: expect.stringMatching(/^halflight-exports\/v1\/u1\/\d{13}-/),
					Metadata: expect.objectContaining({ 'expires-at': expect.any(String) })
				})
			})
		);
	});

	it('rejects malformed artifact ids without touching the bucket', async () => {
		const send = vi.fn();
		const bucket = configuredBucket({ send });
		expect(await bucket.get('u1', '../not-an-export')).toBeNull();
		expect(await bucket.delete('u1', '../not-an-export')).toBe(false);
		expect(send).not.toHaveBeenCalled();
	});

	it("addresses objects under the caller's own prefix and rejects unsafe owners", async () => {
		const send = vi.fn().mockResolvedValue({});
		const bucket = configuredBucket({ send });
		const id = '1999999999999-123e4567-e89b-12d3-a456-426614174000.json';

		await bucket.get('alice', id);
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				input: expect.objectContaining({ Key: `halflight-exports/v1/alice/${id}` })
			})
		);
		send.mockClear();
		expect(await bucket.get('../bob', id)).toBeNull();
		expect(await bucket.delete('a/b', id)).toBe(false);
		expect(send).not.toHaveBeenCalled();
	});
});
