import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.SCREENSHOT_BASE_URL ?? 'https://syn.bluesix.dev';
const outputDirectory = new URL('../static/readme-screenshots/', import.meta.url);

function readDotenvValue(contents, name) {
	const match = contents.match(new RegExp(`^${name}=(.*)$`, 'm'));
	if (!match) throw new Error(`${name} is required to capture private screenshots.`);

	const value = match[1].trim();
	return value.replace(/^(["'])(.*)\1$/, '$2');
}

const dotenv = await readFile(new URL('../.env', import.meta.url), 'utf8');
const username = readDotenvValue(dotenv, 'ADMIN_USERNAME');
const password = readDotenvValue(dotenv, 'ADMIN_PASSWORD');

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

async function capture(filename, path, viewport = { width: 1440, height: 1000 }) {
	await page.setViewportSize(viewport);
	await page.goto(new URL(path, baseUrl).toString(), { waitUntil: 'networkidle' });
	await page.screenshot({ path: new URL(filename, outputDirectory).pathname, fullPage: true });
}

try {
	await capture('01-sign-in-desktop.png', '/sign-in');
	await capture('02-sign-in-mobile.png', '/sign-in', { width: 390, height: 844 });

	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto(new URL('/sign-in', baseUrl).toString(), { waitUntil: 'networkidle' });
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill(password);
	await Promise.all([
		page.waitForURL(new RegExp(`${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/app$`)),
		page.getByRole('button', { name: 'Sign in' }).click()
	]);

	await capture('03-home-desktop.png', '/app');
	await capture('04-home-mobile.png', '/app', { width: 390, height: 844 });
	await capture('05-search-empty.png', '/app/search');
	await capture('06-search-empty-mobile.png', '/app/search', { width: 390, height: 844 });
	await capture('07-search-invalid-query.png', `/app/search?q=${'x'.repeat(161)}`);
	await capture('08-search-results.png', '/app/search?q=radiohead');
	await capture('09-track-invalid.png', '/app/tracks/not-a-track-id');
	await capture('10-tidal-settings.png', '/app/settings/tidal');
	await capture('11-tidal-settings-mobile.png', '/app/settings/tidal', { width: 390, height: 844 });
	await capture('12-search-results-mobile.png', '/app/search?q=radiohead', {
		width: 390,
		height: 844
	});
} finally {
	await browser.close();
}
