import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		getConnectionStatus: vi.fn(),
		search: vi.fn()
	};
});

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus,
	tidalApi: { search: mocks.search }
}));

import { load } from './+page.server';

function createEvent(urlStr: string, user: { id: string } | null = { id: 'u1' }) {
	return {
		locals: { user },
		url: new URL(urlStr),
		fetch: vi.fn(),
		cookies: {} as any
	} as any;
}

describe('/app/search +page.server', () => {
	beforeEach(() => {
		mocks.getConnectionStatus.mockReset();
		mocks.search.mockReset();
	});

	it('extracts query from ?search= parameter', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.search.mockResolvedValue({ data: [], included: [] });

		const result = (await load(createEvent('http://localhost/app/search?search=Moderat'))) as {
			query: string;
			results: any;
		};
		expect(result.query).toBe('Moderat');
		expect(mocks.search).toHaveBeenCalledWith('Moderat', expect.any(Object), expect.any(Object));
	});

	it('falls back to ?q= parameter when ?search= is absent', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });
		mocks.search.mockResolvedValue({ data: [], included: [] });

		const result = (await load(createEvent('http://localhost/app/search?q=Bicep'))) as {
			query: string;
			results: any;
		};
		expect(result.query).toBe('Bicep');
		expect(mocks.search).toHaveBeenCalledWith('Bicep', expect.any(Object), expect.any(Object));
	});

	it('returns empty query and null results when neither is provided', async () => {
		mocks.getConnectionStatus.mockResolvedValue({ connected: true });

		const result = (await load(createEvent('http://localhost/app/search'))) as {
			query: string;
			results: any;
		};
		expect(result.query).toBe('');
		expect(result.results).toBeNull();
		expect(mocks.search).not.toHaveBeenCalled();
	});
});
