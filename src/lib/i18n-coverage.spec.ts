import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the product surfaces against user-facing copy that never reaches the
 * message catalogue.
 *
 * The catalogue itself has stayed at full English/German parity by discipline —
 * German lands in the same commit as the feature. What drifted instead was copy
 * written straight into markup, which produces no missing-key count precisely
 * because nothing ever calls `m.*` for it. This sweep removed 39 such strings;
 * without a check they reappear on the next feature.
 *
 * A follow-up sweep found the same problem one layer deeper: a string passed as
 * a component *prop* — `ariaLabel="Export as M3U8 Playlist"`, `title="MY CUSTOM
 * PLAYLISTS"` — is invisible to a check that only looks at text nodes. One had
 * sat in `/app/library` since before that first sweep; the aria-label case is
 * worse than a visible miss, since it reaches only screen-reader users. Both
 * checks now run.
 *
 * MASTERPLAN.md lists "English and German UI parity" (:219) as a product
 * boundary, and the Definition of done requires "Strings in English and German".
 */

/**
 * `MASTERPLAN.md:220` lists "A developer-only diagnostics area for the owner"
 * separately from the UI-parity boundary, so this one surface is deliberately
 * English-only. Anything added here is a decision, not an oversight.
 */
const ALLOWLIST = ['src/routes/app/admin/+page.svelte'];

/**
 * Storybook catalogue files, not a product surface — a `<Story name="...">`
 * label and realistic example copy inside a story body are developer-facing
 * documentation, not something a listener ever sees.
 */
const STORY_FILE = /\.stories\.svelte$/;

/** Brand names and standards that read identically in every locale. */
const LOCALE_NEUTRAL = /^(TIDAL|Halflight|Last\.fm|API|FLAC|M3U|JSON|PWA|ISRC)\b/;

/** A visible text node between tags, holding no `{...}` expression. */
const TEXT_NODE = />\s*([A-Z][A-Za-z][^<>{}]{5,80}?)\s*</g;

/**
 * A quoted, literal prop value that reads as copy rather than a technical
 * value: capitalised, multi-word. `variant="primary"`, `type="submit"`, and
 * `href="/app"` all miss on shape (lowercase, single token) without needing a
 * prop-name allowlist that would just drift out of date.
 */
const PROP_VALUE = /\b\w+="([A-Z][A-Za-z][^"]{4,90}?\s[^"]{2,90}?)"/g;

function svelteFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return path.includes('paraglide') ? [] : svelteFiles(path);
		return entry.isFile() && entry.name.endsWith('.svelte') ? [path] : [];
	});
}

function hardcodedStrings(path: string): string[] {
	// Only markup: a string inside <script> is as likely to be a CSS class or a
	// key as it is copy, and the `m.*` call sites themselves live there.
	const markup = readFileSync(path, 'utf8').split('</script>').at(-1) ?? '';
	const found: string[] = [];
	for (const pattern of [TEXT_NODE, PROP_VALUE]) {
		for (const match of markup.matchAll(pattern)) {
			const text = match[1].trim();
			if (LOCALE_NEUTRAL.test(text) || !/[a-z]/.test(text)) continue;
			found.push(text);
		}
	}
	return found;
}

describe('i18n coverage', () => {
	it('routes every user-facing string in the product surfaces through the catalogue', () => {
		const offenders = svelteFiles('src')
			.filter((path) => !ALLOWLIST.includes(path) && !STORY_FILE.test(path))
			.map((path) => [path, hardcodedStrings(path)] as const)
			.filter(([, strings]) => strings.length > 0)
			.map(([path, strings]) => `${path}: ${strings.map((s) => JSON.stringify(s)).join(', ')}`);

		expect(offenders).toEqual([]);
	});

	it('keeps the English and German catalogues at full parity', () => {
		const en = JSON.parse(readFileSync('messages/en.json', 'utf8')) as Record<string, string>;
		const de = JSON.parse(readFileSync('messages/de-de.json', 'utf8')) as Record<string, string>;

		expect(Object.keys(de)).toEqual(Object.keys(en));
	});
});
