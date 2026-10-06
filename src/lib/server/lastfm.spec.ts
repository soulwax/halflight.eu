import { describe, expect, it } from 'vitest';
import { createLastfmSignature, parseLastfmScrobbleResult } from './lastfm';

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

describe('parseLastfmScrobbleResult', () => {
	it('distinguishes accepted scrobbles from filtered ones', () => {
		expect(
			parseLastfmScrobbleResult({ scrobbles: { '@attr': { accepted: '1', ignored: '0' } } })
		).toEqual({ status: 'accepted', accepted: 1, ignored: 0 });
		expect(
			parseLastfmScrobbleResult({
				scrobbles: {
					'@attr': { accepted: '0', ignored: '1' },
					scrobble: { ignoredMessage: { code: '3' } }
				}
			})
		).toEqual({ status: 'ignored', accepted: 0, ignored: 1, ignoredCode: 3 });
	});

	it('rejects a response that does not confirm the scrobble result', () => {
		expect(() => parseLastfmScrobbleResult({})).toThrow('Last.fm did not confirm the scrobble.');
	});
});
