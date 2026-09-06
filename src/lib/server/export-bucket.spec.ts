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
					Key: expect.stringMatching(/^halflight-exports\/v1\/\d{13}-/),
					Metadata: expect.objectContaining({ 'expires-at': expect.any(String) })
				})
			})
		);
	});

	it('rejects malformed artifact ids without touching the bucket', async () => {
		const send = vi.fn();
		const bucket = configuredBucket({ send });
		expect(await bucket.get('../not-an-export')).toBeNull();
		expect(await bucket.delete('../not-an-export')).toBe(false);
		expect(send).not.toHaveBeenCalled();
	});
});
