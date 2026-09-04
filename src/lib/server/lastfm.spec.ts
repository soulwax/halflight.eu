import { describe, expect, it } from 'vitest';
import { createLastfmSignature } from './lastfm';

describe('createLastfmSignature', () => {
	it('sorts parameters and excludes format from the caller-supplied signed input', () => {
		expect(
			createLastfmSignature(
				{ method: 'auth.getSession', token: 'yyyyyy', api_key: 'xxxxxxxxxx' },
				'ilovecher'
			)
		).toBe('b87d61da3cda91a8b6746c4aef55d6f8');
	});
});
