import { describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { APP_VERSION } from './version.js';

describe('APP_VERSION', () => {
	// Deliberately not pinned to a literal: that asserted the release number
	// rather than the wiring, so every version bump broke it. What matters is
	// that the app reports the version the package actually declares.
	it('tracks the package version and is a valid semver string', () => {
		expect(APP_VERSION).toBe(pkg.version);
		expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
	});
});
