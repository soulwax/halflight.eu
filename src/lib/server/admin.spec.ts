import { describe, expect, it } from 'vitest';
import {
	getAdministratorEmail,
	isConfiguredAdministratorUsername,
	normalizeUsername
} from './admin';

describe('administrator identity helpers', () => {
	it('normalizes GitHub usernames case-insensitively', () => {
		expect(normalizeUsername('  Syn-Owner  ')).toBe('syn-owner');
	});

	it('derives the same private Better Auth email for equivalent usernames', () => {
		expect(getAdministratorEmail('Syn-Owner')).toBe(getAdministratorEmail('syn-owner'));
		expect(getAdministratorEmail('syn-owner')).toMatch(/^admin-[a-f0-9]{64}@syn\.invalid$/);
	});

	it('matches configured usernames without exposing the configured value', () => {
		expect(isConfiguredAdministratorUsername('not-the-administrator')).toBe(false);
	});
});
