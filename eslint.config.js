// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook';

import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

// Fast, syntax-only rules — run on every `pnpm lint`. The type-aware pass
// (no-floating-promises et al.) lives in eslint.config.typed.js / `pnpm lint:types`
// because building the TS program per run is slow.
export default defineConfig(
	includeIgnoreFile(gitignorePath),
	{ ignores: ['src/lib/paraglide/**', 'storybook-static/**'] },
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	storybook.configs['flat/recommended'],
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: { extraFileExtensions: ['.svelte'], parser: ts.parser }
		},
		rules: {
			'svelte/button-has-type': 'error',
			'svelte/require-each-key': 'error'
		}
	},
	{
		files: ['**/*.spec.ts', '**/*.spec.js', '**/*.e2e.ts'],
		rules: {
			// Test doubles legitimately need `any`; `typeof import()` is the idiomatic
			// way to type `vi.importActual`.
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/consistent-type-imports': 'off'
		}
	}
);
