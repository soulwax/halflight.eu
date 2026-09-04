import { describe, expect, it, vi } from 'vitest';
import { pollDeviceToken, refreshDeviceToken, requestDeviceAuthorization } from './device-auth';

import { TidalAuthError, TidalError } from './errors';

describe('device-auth module (translated from tiddl)', () => {
	it('requests device authorization code', async () => {
		const mockResponse = {
			deviceCode: 'dev-123',
			userCode: 'ABCD',
			verificationUri: 'link.tidal.com',
			verificationUriComplete: 'link.tidal.com/ABCD',
			expiresIn: 300,
			interval: 2
		};

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse
		});

		const res = await requestDeviceAuthorization(fetchMock as unknown as typeof fetch);
		expect(res.deviceCode).toBe('dev-123');
		expect(res.verificationUriComplete).toBe('link.tidal.com/ABCD');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://auth.tidal.com/v1/oauth2/device_authorization',
			expect.objectContaining({
				method: 'POST'
			})
		);
	});

	it('throws error when device authorization request fails', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			text: async () => 'Internal Server Error'
		});

		await expect(requestDeviceAuthorization(fetchMock as unknown as typeof fetch)).rejects.toThrow(
			TidalError
		);
	});

	it('returns pending while waiting for user authorization', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({
				error: 'authorization_pending'
			})
		});

		const res = await pollDeviceToken('dev-123', fetchMock as unknown as typeof fetch);
		expect(res.status).toBe('pending');
	});

	it('returns expired when device code expires', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({
				error: 'expired_token'
			})
		});

		const res = await pollDeviceToken('dev-123', fetchMock as unknown as typeof fetch);
		expect(res.status).toBe('expired');
	});

	it('returns success with token record when user authorizes', async () => {
		const mockTokenData = {
			access_token: 'acc-token-xyz',
			refresh_token: 'ref-token-xyz',
			expires_in: 86400,
			token_type: 'Bearer',
			scope: 'r_usr+w_usr+w_sub',
			user_id: 123456,
			user: {
				userId: 123456,
				countryCode: 'DE'
			}
		};

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockTokenData
		});

		const res = await pollDeviceToken('dev-123', fetchMock as unknown as typeof fetch);
		expect(res.status).toBe('success');
		if (res.status === 'success') {
			expect(res.record.accessToken).toBe('acc-token-xyz');
			expect(res.record.refreshToken).toBe('ref-token-xyz');
			expect(res.record.scope).toContain('r_usr');
			expect(res.record.countryCode).toBe('DE');
			expect(res.countryCode).toBe('DE');
		}
	});

	it('refreshes token using device client credentials', async () => {
		const mockTokenData = {
			access_token: 'new-acc-token',
			refresh_token: 'new-ref-token',
			expires_in: 86400,
			token_type: 'Bearer',
			scope: 'r_usr+w_usr+w_sub',
			user_id: 123456
		};

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockTokenData
		});

		const record = await refreshDeviceToken(
			'old-ref-token',
			fetchMock as unknown as typeof fetch,
			'DE'
		);
		expect(record.accessToken).toBe('new-acc-token');
		expect(record.refreshToken).toBe('new-ref-token');
		expect(record.countryCode).toBe('DE');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://auth.tidal.com/v1/oauth2/token',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					authorization: expect.stringMatching(/^Basic /)
				})
			})
		);
	});

	it('throws TidalAuthError when refresh fails', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({
				error: 'invalid_grant',
				error_description: 'Refresh token expired'
			})
		});

		await expect(
			refreshDeviceToken('dead-ref-token', fetchMock as unknown as typeof fetch)
		).rejects.toThrow(TidalAuthError);
	});
});
