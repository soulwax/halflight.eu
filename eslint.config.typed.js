import base from './eslint.config.js';
import ts from 'typescript-eslint';

// The full lint: everything in eslint.config.js PLUS type-aware rules that need a
// TypeScript program. Slower (`projectService` builds the program per run), so
// this is `pnpm lint:types` — run it before pushing and in CI, not on every save.
export default [
	...base,
	// Build tooling / ambient declarations are not in tsconfig's `include`, so the
	// project service can't type-check them — and they don't need type-aware rules.
	{ ignores: ['*.config.{js,ts,cjs,mjs}', 'vitest.shims.d.ts', 'svelte.config.js'] },
	{
		languageOptions: {
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
		},
		rules: {
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/await-thenable': 'error',
			'@typescript-eslint/require-await': 'error',
			'@typescript-eslint/switch-exhaustiveness-check': [
				'error',
				{ considerDefaultExhaustiveForUnions: true }
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		files: ['**/*.spec.ts', '**/*.spec.js', '**/*.e2e.ts'],
		rules: {
			// Store/adapter test doubles implement `async` interface methods that have
			// nothing to await; the shared shape is the point.
			'@typescript-eslint/require-await': 'off'
		}
	}
];
