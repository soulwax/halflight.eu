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
 * MASTERPLAN.md lists "English and German UI parity" (:219) as a product
 * boundary, and the Definition of done requires "Strings in English and German".
 */

/**
 * `MASTERPLAN.md:220` lists "A developer-only diagnostics area for the owner"
 * separately from the UI-parity boundary, so this one surface is deliberately
 * English-only. Anything added here is a decision, not an oversight.
 */
const ALLOWLIST = ['src/routes/app/admin/+page.svelte'];

/** Brand names and standards that read identically in every locale. */
const LOCALE_NEUTRAL = /^(TIDAL|Halflight|Last\.fm|API|FLAC|M3U|JSON|PWA|ISRC)\b/;

/** A visible text node between tags, holding no `{...}` expression. */
const TEXT_NODE = />\s*([A-Z][A-Za-z][^<>{}]{5,80}?)\s*</g;

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
	for (const match of markup.matchAll(TEXT_NODE)) {
		const text = match[1].trim();
		if (LOCALE_NEUTRAL.test(text) || !/[a-z]/.test(text)) continue;
		found.push(text);
	}
	return found;
}

describe('i18n coverage', () => {
	it('routes every user-facing string in the product surfaces through the catalogue', () => {
		const offenders = svelteFiles('src')
			.filter((path) => !ALLOWLIST.includes(path))
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
