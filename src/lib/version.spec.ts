import { describe, expect, it } from 'vitest';
import { APP_VERSION } from './version.js';

describe('APP_VERSION', () => {
	it('starts with version 0.0.1 and is a valid semver string', () => {
		expect(APP_VERSION).toBe('0.0.1');
		expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
	});
});
