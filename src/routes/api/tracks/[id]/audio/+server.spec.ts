import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('GET /api/tracks/[id]/audio', () => {
	it('refuses the retired Vercel audio proxy', async () => {
		await expect(GET({} as Parameters<typeof GET>[0])).rejects.toMatchObject({ status: 410 });
	});
});
