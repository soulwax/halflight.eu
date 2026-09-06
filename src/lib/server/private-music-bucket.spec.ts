import { describe, expect, it, vi } from 'vitest';
import { createPrivateMusicBucket } from './private-music-bucket';

const key = 'halflight-private-music/v1/123e4567-e89b-12d3-a456-426614174000';

function configuredBucket(client?: { send(command: unknown): Promise<unknown> }) {
	return createPrivateMusicBucket(
		{
			bucket: 'private-music',
			endpoint: 'https://bucket.example.test',
			accessKeyId: 'key',
			secretAccessKey: 'secret'
		},
		client
	);
}

describe('private music bucket', () => {
	it('remains disabled until the dedicated bucket configuration is complete', () => {
		expect(createPrivateMusicBucket({ bucket: 'private-music' }).enabled).toBe(false);
	});

	it('forwards a validated download range to the private object', async () => {
		const send = vi.fn().mockResolvedValue({
			Body: { transformToWebStream: () => new ReadableStream<Uint8Array>() }
		});
		const bucket = configuredBucket({ send });

		await bucket.get(key, 'bytes=4-9');

		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({
				input: { Bucket: 'private-music', Key: key, Range: 'bytes=4-9' }
			})
		);
	});

	it('does not request malformed object keys', async () => {
		const send = vi.fn();
		const bucket = configuredBucket({ send });

		expect(await bucket.get('../not-private-music')).toBeNull();
		expect(send).not.toHaveBeenCalled();
	});
});
