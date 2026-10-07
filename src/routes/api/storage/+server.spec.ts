import { describe, expect, it, vi } from 'vitest';
const overview = vi.hoisted(() => vi.fn().mockResolvedValue({ exportsEnabled: false }));
vi.mock('#lib/server/storage', () => ({ getStorageOverview: overview }));
import { GET } from './+server';

describe('/api/storage', () => {
	it('protects private summaries from unauthenticated callers', async () => {
		await expect(GET({ locals: {} } as never)).rejects.toMatchObject({ status: 401 });
		await expect(
			GET({ locals: { user: { id: 'user' }, isListener: false } } as never)
		).rejects.toMatchObject({ status: 401 });
	});
	it('returns uncached summaries for the current listener', async () => {
		const response = await GET({ locals: { user: { id: 'user' }, isListener: true } } as never);
		expect(overview).toHaveBeenCalledWith('user');
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toEqual({ exportsEnabled: false });
	});
});
