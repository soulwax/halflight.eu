import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProvisionalSet } from '#lib/taste/provisional';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	getGenerationCooldownTrackIds: vi.fn(),
	getTasteProfile: vi.fn(),
	generateTasteSet: vi.fn(),
	createLiveGraphClient: vi.fn()
}));

vi.mock('#lib/server/tidal', () => ({ getConnectionStatus: mocks.getConnectionStatus }));
vi.mock('#lib/server/taste/cooldown', () => ({
	getGenerationCooldownTrackIds: mocks.getGenerationCooldownTrackIds
}));
vi.mock('#lib/server/taste/profile', () => ({ getTasteProfile: mocks.getTasteProfile }));
vi.mock('#lib/server/taste/generate', () => ({ generateTasteSet: mocks.generateTasteSet }));
vi.mock('#lib/server/taste/graph', () => ({ createLiveGraphClient: mocks.createLiveGraphClient }));

import { POST } from './+server';

const set: ProvisionalSet = {
	tracks: [],
	trackCount: 0,
	knownDurationSeconds: 0,
	unknownDurationCount: 0,
	estimatedDurationSeconds: 0,
	discoveryPercentage: 0,
	confidenceLabel: 'initial',
	degraded: false,
	generatedAt: '2026-09-11T00:00:00.000Z'
};

function eventFor(
	user: { id: string } | null = { id: 'owner-1' },
	isListener = true
): Parameters<typeof POST>[0] {
	const form = new FormData();
	form.set('targetCount', '20');
	form.set('familiarity', '50');
	return {
		locals: { user, isListener },
		request: new Request('http://localhost/api/taste/generate', { method: 'POST', body: form }),
		fetch: vi.fn(),
		cookies: {}
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/taste/generate', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.getGenerationCooldownTrackIds.mockReset();
		mocks.getTasteProfile.mockReset();
		mocks.generateTasteSet.mockReset();
		mocks.createLiveGraphClient.mockReset();
		mocks.createLiveGraphClient.mockReturnValue({});
	});

	it('rejects signed-in non-owners before contacting TIDAL', async () => {
		await expect(POST(eventFor({ id: 'not-owner' }, false))).rejects.toMatchObject({ status: 401 });
		expect(mocks.getConnectionStatus).not.toHaveBeenCalled();
	});

	it('requires an active TIDAL connection', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: false });

		const response = await POST(eventFor());

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ errorCode: 'generation_connection_required' });
		expect(mocks.generateTasteSet).not.toHaveBeenCalled();
	});

	it('streams count-only progress followed by the completed set', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.getTasteProfile.mockResolvedValue({ artists: { artist: 1 } });
		mocks.getGenerationCooldownTrackIds.mockResolvedValue(new Set());
		mocks.generateTasteSet.mockImplementation(async (_profile, options) => {
			options.onProgress?.({ stage: 'expanding', requestsSpent: 2, candidateCount: 8 });
			options.onProgress?.({ stage: 'scoring', candidateCount: 6 });
			return set;
		});

		const response = await POST(eventFor());
		const events = (await response.text())
			.trim()
			.split('\n\n')
			.map((line) => JSON.parse(line.slice('data: '.length)));

		expect(response.headers.get('content-type')).toContain('text/event-stream');
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(events).toEqual([
			expect.objectContaining({
				type: 'progress',
				stage: 'expanding',
				requestsSpent: 2,
				candidateCount: 8,
				sequence: 0
			}),
			expect.objectContaining({
				type: 'progress',
				stage: 'scoring',
				candidateCount: 6,
				sequence: 1
			}),
			expect.objectContaining({ type: 'complete', set, sequence: 2 })
		]);
		expect(mocks.generateTasteSet).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				knobs: { targetCount: 20, familiarity: 50, excludeExplicit: false },
				signal: expect.any(AbortSignal)
			})
		);
	});
});
