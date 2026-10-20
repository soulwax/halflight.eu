import { expect, test } from '@playwright/test';

test('production PWA caches only the public recovery shell and serves it offline', async ({
	page,
	context
}) => {
	await page.goto('/home');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload();
	await expect
		.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
		.toBe(true);
	const manifest = await page.evaluate(async () => {
		const response = await fetch('/manifest.webmanifest');
		return {
			contentType: response.headers.get('content-type'),
			manifest: await response.json()
		};
	});
	expect(manifest.contentType).toContain('manifest+json');
	expect(manifest.manifest).toMatchObject({
		id: '/halflight-now',
		name: 'Halflight Now',
		short_name: 'Halflight',
		start_url: '/home',
		scope: '/',
		display: 'standalone',
		orientation: 'any'
	});
	expect(manifest.manifest.icons).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ src: '/icons/halflight-192.png', sizes: '192x192' }),
			expect.objectContaining({ src: '/icons/halflight-512.png', sizes: '512x512' }),
			expect.objectContaining({
				src: '/icons/halflight-maskable-512.png',
				sizes: '512x512',
				purpose: 'maskable'
			})
		])
	);
	expect(manifest.manifest.shortcuts.map((shortcut: { url: string }) => shortcut.url)).toEqual([
		'/home',
		'/now',
		'/search'
	]);

	const cache = await page.evaluate(async () => {
		const keys = await caches.keys();
		const paths: string[] = [];
		for (const key of keys) {
			const entries = await (await caches.open(key)).keys();
			paths.push(...entries.map((request) => new URL(request.url).pathname));
		}
		return { keys, paths };
	});

	expect(cache.keys).toHaveLength(1);
	expect(cache.paths).toContain('/offline');
	expect(cache.paths).toContain('/de-de/offline');
	expect(cache.paths).toContain('/desktop-offline');
	expect(cache.paths).toContain('/de-de/desktop-offline');
	expect(cache.paths).toContain('/manifest.webmanifest');
	expect(cache.paths).toContain('/manifest-desktop.webmanifest');
	expect(cache.paths).toContain('/icons/halflight-maskable-512.png');
	const germanFallback = await page.evaluate(async () => {
		const cache = await caches.open((await caches.keys())[0]);
		const response = await cache.match('/de-de/offline');
		return response ? { status: response.status, url: response.url } : null;
	});
	expect(germanFallback?.status).toBe(200);
	const germanDesktopFallback = await page.evaluate(async () => {
		const cache = await caches.open((await caches.keys())[0]);
		const response = await cache.match('/de-de/desktop-offline');
		return response ? { status: response.status, url: response.url } : null;
	});
	expect(germanDesktopFallback?.status).toBe(200);
	const approved = new Set([
		'/icons/halflight-32.png',
		'/icons/halflight-180.png',
		'/icons/halflight-192.png',
		'/icons/halflight-512.png',
		'/icons/halflight-maskable-512.png',
		'/manifest.webmanifest',
		'/manifest-desktop.webmanifest',
		'/offline',
		'/de-de/offline',
		'/desktop-offline',
		'/de-de/desktop-offline'
	]);
	const unexpected = cache.paths.filter(
		(path) =>
			!approved.has(path) &&
			!/^\/_app\/immutable\/assets\/(0|AppHeader|Dialog|Notice|OfflineRecovery|SearchField)\.[^/]+\.css$/.test(
				path
			)
	);
	expect(unexpected).toEqual([]);
	expect(cache.paths.some((path) => /\.m?js$/.test(path))).toBe(false);
	expect(cache.paths.some((path) => path.includes('/api/') || path.includes('/audio'))).toBe(false);

	await context.setOffline(true);
	await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
	await page.goto('/de-de/home');
	await expect(page.locator('main')).toHaveAttribute('lang', 'de-de');
	await expect(page.getByRole('heading', { name: 'Du bist offline' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Erneut versuchen' })).toHaveAttribute(
		'href',
		'/de-de/home'
	);

	const apiFailedOffline = await page.evaluate(async () => {
		try {
			await fetch('/api/search');
			return false;
		} catch {
			return true;
		}
	});
	expect(apiFailedOffline).toBe(true);

	await page.goto('/de-de/app/search');
	await expect(page.getByRole('heading', { name: 'Du bist offline' })).toBeVisible();
	await expect(
		page.getByText(/Der Halflight Listening Room benötigt eine Verbindung/)
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Erneut versuchen' })).toHaveAttribute(
		'href',
		'/de-de/app'
	);
});

test('desktop Listening Room links its own install identity and launch destination', async ({
	page
}) => {
	await page.goto('/app');
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
		'href',
		'/manifest-desktop.webmanifest'
	);

	const manifest = await page.evaluate(async () => {
		const response = await fetch('/manifest-desktop.webmanifest');
		return response.json();
	});
	expect(manifest).toMatchObject({
		id: '/halflight-desktop',
		name: 'Halflight Listening Room',
		start_url: '/app',
		scope: '/',
		display: 'standalone'
	});
	expect(manifest.shortcuts.map((shortcut: { url: string }) => shortcut.url)).toEqual([
		'/app',
		'/app/search',
		'/app/library',
		'/app/generate'
	]);
});
