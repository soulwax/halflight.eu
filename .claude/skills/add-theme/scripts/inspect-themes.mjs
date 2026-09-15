#!/usr/bin/env node
/**
 * Drives a running dev server with a real headless browser and reads back
 * REAL computed styles — not source, not a screenshot alone — for a set of
 * themes. This exists because unit tests and Storybook do not catch a theme
 * whose "beyond colour" tokens (radius, shadow, motion, heading font) fail
 * to apply: colour tokens have no competing default to lose to, so they
 * pass every other signal while radius/shadow/motion/font silently fall
 * back to dark's values. See the skill's SKILL.md for the incident this
 * script was built to prevent a repeat of.
 *
 * Must be run from the project root so `playwright` resolves from
 * node_modules — copy it there temporarily if invoking from elsewhere:
 *   cp .claude/skills/add-theme/scripts/inspect-themes.mjs ./.tmp-inspect-themes.mjs
 *   node ./.tmp-inspect-themes.mjs --themes=dark,light,warm-night,electric,<new-id>
 *   rm ./.tmp-inspect-themes.mjs
 *
 * Requires a dev server already running (pnpm dev, default localhost:5173).
 *
 * Usage:
 *   node inspect-themes.mjs [--base=http://localhost:5173] [--path=/sign-in]
 *                            [--themes=dark,light,warm-night,electric]
 *                            [--out=<dir for screenshots>]
 */
import { chromium } from 'playwright';

const args = Object.fromEntries(
	process.argv.slice(2).map((arg) => {
		const [key, value] = arg.replace(/^--/, '').split('=');
		return [key, value ?? true];
	})
);

const BASE = args.base ?? 'http://localhost:5173';
const PATH = args.path ?? '/sign-in';
const THEMES = (args.themes ?? 'dark,light,warm-night,electric').split(',');
const OUT = args.out ?? null;

const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
	const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
	const page = await context.newPage();
	page.on('pageerror', (err) => console.error('[page error]', err.message));

	const results = {};

	for (const theme of THEMES) {
		await context.clearCookies();
		await context.addCookies([{ name: 'hf-theme', value: theme, url: BASE, sameSite: 'Lax' }]);
		await page.goto(`${BASE}${PATH}`, { waitUntil: 'networkidle', timeout: 60000 });
		await page.waitForSelector('h1', { timeout: 15000 }).catch(() => {});

		// Read the actual, resolved custom properties off <html> — this is
		// what every theme block claims to set, and the one thing a passing
		// unit test or a colour-only screenshot cannot tell you got applied.
		const info = await page.evaluate(() => {
			const root = getComputedStyle(document.documentElement);
			const h1 = document.querySelector('h1');
			const h1s = h1 ? getComputedStyle(h1) : null;
			const token = (name) => root.getPropertyValue(name).trim();
			return {
				dataTheme: document.documentElement.dataset.theme,
				tokens: {
					'--paper': token('--paper'),
					'--action': token('--action'),
					'--radius-md': token('--radius-md'),
					'--shadow-panel': token('--shadow-panel'),
					'--font-heading': token('--font-heading'),
					'--heading-weight': token('--heading-weight'),
					'--heading-tracking': token('--heading-tracking'),
					'--heading-transform': token('--heading-transform'),
					'--dur-fast': token('--dur-fast')
				},
				h1Computed: h1s && {
					fontFamily: h1s.fontFamily,
					fontWeight: h1s.fontWeight,
					letterSpacing: h1s.letterSpacing,
					textTransform: h1s.textTransform
				}
			};
		});

		if (info.dataTheme !== theme) {
			console.error(
				`✗ ${theme}: data-theme on <html> reads "${info.dataTheme}", expected "${theme}"`
			);
		}

		results[theme] = info;
		console.log(`\n=== ${theme} ===`);
		console.log(JSON.stringify(info, null, 2));

		if (OUT) {
			await page.screenshot({ path: `${OUT}/${PATH.replace(/\W+/g, '-')}-${theme}.png` });
		}
	}

	// The actual check this script exists for: every theme's non-colour
	// tokens must differ from at least one other theme's. If every theme
	// reports the identical --radius-md/--font-heading/--shadow-panel, the
	// cascade-order bug (or something like it) is back — colours alone
	// cannot tell you that.
	const radii = new Set(THEMES.map((t) => results[t].tokens['--radius-md']));
	const fonts = new Set(THEMES.map((t) => results[t].tokens['--font-heading']));
	if (THEMES.length > 1 && radii.size === 1) {
		console.error(
			`\n✗ Every theme reports the same --radius-md (${[...radii][0]}). ` +
				'If these themes are meant to differ, the theme registry\'s tokens are not applying — see the SKILL.md "cascade order" section before assuming this is fine.'
		);
	}
	if (THEMES.length > 1 && fonts.size === 1) {
		console.error(
			`\n⚠ Every theme reports the same --font-heading (${[...fonts][0]}). This is fine if none of them override it on purpose.`
		);
	}
} finally {
	await browser.close();
}
