import { describe, expect, it, vi } from 'vitest';
vi.mock('#lib/server/db', () => ({ db: {} }));
vi.mock('$app/env/private', () => ({
	ADMIN_USERNAME: 'configured-owner',
	ADMIN_PASSWORD: 'test-only',
	ADMIN_GITHUB_ID: '1001'
}));
import { getAdministratorEmail } from './admin';
import { getRequestAccess } from './request-access';

const identity = { id: 'owner', name: 'Listener', email: 'listener@example.test' };
const record = { status: 'active', role: null, firstUserId: null };

describe('request access boundary', () => {
	it('reads permissions once and preserves all supported owner identities', async () => {
		for (const [account, access] of [
			[identity, { ...record, role: 'owner' }],
			[identity, { ...record, firstUserId: identity.id }],
			[identity, { ...record, role: 'owner', ownsAdminGithub: true }],
			[{ ...identity, email: getAdministratorEmail() }, record]
		] as const) {
			const lookup = vi.fn().mockResolvedValue(access);
			expect(await getRequestAccess(account, lookup, vi.fn())).toEqual({
				active: true,
				isAdministrator: true,
				isFirstAdministrator: true
			});
			expect(lookup).toHaveBeenCalledExactlyOnceWith(identity.id);
		}
	});
	it('never grants ownership from a display name, whatever the sign-in method', async () => {
		for (const name of ['configured-owner', ' CONFIGURED-OWNER ']) {
			expect(await getRequestAccess({ ...identity, name }, async () => record)).toEqual({
				active: true,
				isAdministrator: false,
				isFirstAdministrator: false
			});
		}
	});
	it("treats any sign-in to the owner's GitHub-linked user as the owner and records it", async () => {
		// The session carries no provider: a TIDAL sign-in to the same Syn user
		// resolves to the same access record as a GitHub one.
		const persist = vi.fn().mockResolvedValue(undefined);
		expect(
			await getRequestAccess(identity, async () => ({ ...record, ownsAdminGithub: true }), persist)
		).toEqual({ active: true, isAdministrator: true, isFirstAdministrator: true });
		expect(persist).toHaveBeenCalledExactlyOnceWith(identity.id);
	});
	it('distinguishes an ordinary administrator from the owner and a regular user', async () => {
		expect(await getRequestAccess(identity, async () => ({ ...record, role: 'admin' }))).toEqual({
			active: true,
			isAdministrator: true,
			isFirstAdministrator: false
		});
		expect(await getRequestAccess(identity, async () => record)).toEqual({
			active: true,
			isAdministrator: false,
			isFirstAdministrator: false
		});
	});
	it.each(['banned', 'archived'])(
		'denies a %s account even when it is an owner',
		async (status) => {
			expect(
				await getRequestAccess(identity, async () => ({ ...record, status, role: 'owner' }))
			).toEqual({
				active: false,
				isAdministrator: false,
				isFirstAdministrator: false
			});
		}
	);
	it('does not grant access to a deleted account or retain a revoked role', async () => {
		const lookup = vi
			.fn()
			.mockResolvedValueOnce({ ...record, role: 'admin' })
			.mockResolvedValueOnce(record)
			.mockResolvedValueOnce(undefined);
		expect((await getRequestAccess(identity, lookup)).isAdministrator).toBe(true);
		expect((await getRequestAccess(identity, lookup)).isAdministrator).toBe(false);
		expect(await getRequestAccess(identity, lookup)).toEqual({
			active: false,
			isAdministrator: false,
			isFirstAdministrator: false
		});
	});
});
