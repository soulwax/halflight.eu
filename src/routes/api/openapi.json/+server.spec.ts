import { describe, expect, it } from 'vitest';
import { GET } from './+server';

function event(isAdministrator = true) {
	return {
		locals: { user: { id: 'owner' }, isAdministrator }
	} as unknown as Parameters<typeof GET>[0];
}

describe('/api/openapi.json', () => {
	it('returns the private OpenAPI document only to the owner', async () => {
		const response = await GET(event());
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect((await response.json()).openapi).toBe('3.1.0');
	});

	it('rejects a non-owner before generating the document', () => {
		expect(() => GET(event(false))).toThrow(expect.objectContaining({ status: 401 }));
	});
});
