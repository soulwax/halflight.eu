import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getConnectionStatus: vi.fn(),
	canManageUser: vi.fn(),
	addAdministrator: vi.fn(),
	removeAdministrator: vi.fn(),
	setUserStatus: vi.fn(),
	kickUser: vi.fn(),
	getAllUsersWithAdminStatus: vi.fn(),
	signUpEmail: vi.fn()
}));

vi.mock('#lib/server/tidal', () => ({
	getConnectionStatus: mocks.getConnectionStatus
}));

vi.mock('#lib/server/admin', () => ({
	canManageUser: mocks.canManageUser,
	addAdministrator: mocks.addAdministrator,
	removeAdministrator: mocks.removeAdministrator,
	setUserStatus: mocks.setUserStatus,
	kickUser: mocks.kickUser,
	getAllUsersWithAdminStatus: mocks.getAllUsersWithAdminStatus
}));

vi.mock('#lib/server/auth', () => ({
	auth: {
		api: {
			signUpEmail: mocks.signUpEmail
		}
	}
}));

vi.mock('#lib/server/db', () => ({
	db: {
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockResolvedValue([{ value: 5 }])
		}),
		execute: vi.fn().mockResolvedValue({})
	}
}));

import { load, actions } from './+page.server';

function createEvent(
	options: {
		user?: { id: string; name?: string; email?: string } | null;
		isAdministrator?: boolean;
		isFirstAdministrator?: boolean;
		formData?: Record<string, string>;
	} = {}
) {
	const fd = new FormData();
	if (options.formData) {
		for (const [key, val] of Object.entries(options.formData)) {
			fd.append(key, val);
		}
	}

	return {
		locals: {
			user: options.user !== undefined ? options.user : { id: 'admin-1', name: 'soulwax' },
			isAdministrator: options.isAdministrator ?? true,
			isFirstAdministrator: options.isFirstAdministrator ?? true
		},
		request: {
			formData: () => Promise.resolve(fd)
		}
	} as any;
}

describe('/app/admin +page.server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getConnectionStatus.mockResolvedValue({
			configured: true,
			connected: true,
			hasWriteScopes: true
		});
		mocks.getAllUsersWithAdminStatus.mockResolvedValue([
			{
				id: 'u-1',
				name: 'soulwax',
				email: 'soulwax@syn.invalid',
				emailVerified: true,
				createdAt: new Date(),
				adminRole: 'owner',
				isFirstAdmin: true,
				status: 'active'
			},
			{
				id: 'u-2',
				name: 'regular',
				email: 'user@example.com',
				emailVerified: false,
				createdAt: new Date(),
				adminRole: null,
				isFirstAdmin: false,
				status: 'active'
			}
		]);
	});

	it('throws 403 when user is not an administrator', async () => {
		expect.assertions(2);
		const event = createEvent({ isAdministrator: false });
		try {
			await load(event);
			throw new Error('Expected load to throw');
		} catch (err: any) {
			expect(err?.status).toBe(403);
			expect(err?.body?.message ?? err?.message).toContain('Forbidden');
		}
	});
	it('returns global info and user list for authorized administrators', async () => {
		expect.assertions(4);
		const event = createEvent({ isAdministrator: true, isFirstAdministrator: true });
		const result = await load(event);
		if (!result) throw new Error('Expected load result');

		expect(result.globalInfo.userCount).toBe(5);
		expect(result.globalInfo.tidal.connected).toBe(true);
		expect(result.users).toHaveLength(2);
		expect(result.isFirstAdmin).toBe(true);
	});

	describe('actions', () => {
		it('promote promotes user when permitted', async () => {
			expect.assertions(2);
			mocks.canManageUser.mockResolvedValue({ allowed: true });
			mocks.addAdministrator.mockResolvedValue(true);

			const event = createEvent({ formData: { targetUserId: 'u-2' } });
			const res = await (actions.promote as any)(event);

			expect(mocks.canManageUser).toHaveBeenCalledWith('admin-1', 'u-2', 'promote');
			expect(res).toEqual({ success: true, message: 'User promoted to administrator' });
		});

		it('promote fails when not permitted', async () => {
			expect.assertions(2);
			mocks.canManageUser.mockResolvedValue({ allowed: false, reason: 'Not allowed' });

			const event = createEvent({ formData: { targetUserId: 'u-2' } });
			const res = await (actions.promote as any)(event);

			expect(res.status).toBe(403);
			expect(res.data.error).toBe('Not allowed');
		});

		it('demote demotes administrator when permitted', async () => {
			expect.assertions(2);
			mocks.canManageUser.mockResolvedValue({ allowed: true });
			mocks.removeAdministrator.mockResolvedValue(true);

			const event = createEvent({ formData: { targetUserId: 'u-2' } });
			const res = await (actions.demote as any)(event);

			expect(mocks.removeAdministrator).toHaveBeenCalledWith('u-2');
			expect(res).toEqual({ success: true, message: 'Administrator demoted to user' });
		});

		it('kick removes user account when permitted', async () => {
			expect.assertions(2);
			mocks.canManageUser.mockResolvedValue({ allowed: true });
			mocks.kickUser.mockResolvedValue(true);

			const event = createEvent({ formData: { targetUserId: 'u-2' } });
			const res = await (actions.kick as any)(event);

			expect(mocks.kickUser).toHaveBeenCalledWith('u-2');
			expect(res).toEqual({ success: true, message: 'User removed from system' });
		});

		it('ban updates user status to banned', async () => {
			expect.assertions(2);
			mocks.canManageUser.mockResolvedValue({ allowed: true });

			const event = createEvent({ formData: { targetUserId: 'u-2', reason: 'Spam' } });
			const res = await (actions.ban as any)(event);

			expect(mocks.setUserStatus).toHaveBeenCalledWith('u-2', 'banned', 'Spam');
			expect(res).toEqual({ success: true, message: 'User account banned' });
		});

		it('archive updates user status to archived', async () => {
			expect.assertions(2);
			mocks.canManageUser.mockResolvedValue({ allowed: true });

			const event = createEvent({ formData: { targetUserId: 'u-2' } });
			const res = await (actions.archive as any)(event);

			expect(mocks.setUserStatus).toHaveBeenCalledWith('u-2', 'archived', undefined);
			expect(res).toEqual({ success: true, message: 'User account archived' });
		});

		it('unban restores user status to active', async () => {
			expect.assertions(2);
			mocks.canManageUser.mockResolvedValue({ allowed: true });

			const event = createEvent({ formData: { targetUserId: 'u-2' } });
			const res = await (actions.unban as any)(event);

			expect(mocks.setUserStatus).toHaveBeenCalledWith('u-2', 'active');
			expect(res).toEqual({ success: true, message: 'User status restored to active' });
		});

		it('createUser signs up a user and adds admin privileges when makeAdmin is checked', async () => {
			expect.assertions(3);
			mocks.signUpEmail.mockResolvedValue({ user: { id: 'new-u' } });
			mocks.addAdministrator.mockResolvedValue(true);

			const event = createEvent({
				formData: {
					name: 'New Admin',
					email: 'newadmin@example.com',
					password: 'securepassword123',
					makeAdmin: 'on'
				}
			});
			const res = await (actions.createUser as any)(event);

			expect(mocks.signUpEmail).toHaveBeenCalledWith({
				body: {
					name: 'New Admin',
					email: 'newadmin@example.com',
					password: 'securepassword123',
					callbackURL: '/app'
				}
			});
			expect(mocks.addAdministrator).toHaveBeenCalledWith('new-u');
			expect(res).toEqual({ success: true, message: 'User created successfully' });
		});
	});
});
