import { describe, expect, it } from 'vitest';
import { apiEndpoints, createOpenApiDocument, endpointsForGroup } from './api-reference';

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

	it('builds a credential-free OpenAPI document from the curated catalogue', () => {
		const document = createOpenApiDocument();
		expect(document.openapi).toBe('3.1.0');
		expect(document.paths['/api/private-music']?.get?.operationId).toBe('private-music-list');
		expect(JSON.stringify(document)).not.toMatch(/secret|token|bucket key/i);
	});
});
