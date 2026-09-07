import { describe, expect, it } from 'vitest';
import { apiEndpoints, endpointsForGroup } from './api-reference';

describe('API reference catalogue', () => {
	it('documents only application API routes and keeps runnable requests read-only', () => {
		for (const endpoint of apiEndpoints) {
			expect(endpoint.path).toMatch(/^\/api\//);
			if (endpoint.examplePath) expect(endpoint.method).toBe('GET');
		}
	});

	it('includes the owner private-music storage surface', () => {
		expect(endpointsForGroup('storage').map((endpoint) => endpoint.id)).toEqual(
			expect.arrayContaining(['private-music-list', 'private-music-upload', 'private-music-export'])
		);
	});
});
