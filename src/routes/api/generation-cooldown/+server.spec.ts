import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ recordGenerationCooldown: vi.fn() }));

vi.mock('#lib/server/taste/cooldown', () => ({
	recordGenerationCooldown: mocks.recordGenerationCooldown
}));

import { POST } from './+server';

function event(body: string, user: { id: string } | null = { id: 'owner-1' }) {
	return {
		locals: { user },
		request: new Request('http://localhost/api/generation-cooldown', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body
		})
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/generation-cooldown', () => {
	beforeEach(() => {
		mocks.recordGenerationCooldown.mockReset();
	});

	it('requires an authenticated owner', async () => {
		await expect(POST(event('{"trackIds":["track-1"]}', null))).rejects.toMatchObject({
			status: 401
		});
	});

	it('rejects malformed or oversized requests before persistence', async () => {
		const response = await POST(event('{"trackIds":["track-1",42]}'));

		expect(response.status).toBe(400);
		expect(mocks.recordGenerationCooldown).not.toHaveBeenCalled();
	});

	it('persists only validated IDs and returns no content', async () => {
		const response = await POST(event('{"trackIds":[" track-1 ","track-2"]}'));

		expect(response.status).toBe(204);
		expect(mocks.recordGenerationCooldown).toHaveBeenCalledWith('owner-1', ['track-1', 'track-2']);
	});
});
