import base from './eslint.config.js';
import ts from 'typescript-eslint';

// The full lint: everything in eslint.config.js PLUS type-aware rules that need a
// TypeScript program. Slower (`projectService` builds the program per run), so
// this is `pnpm lint:types` — run it before pushing and in CI, not on every save.
export default [
	...base,
	{
		languageOptions: {
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
		},
		rules: {
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/await-thenable': 'error',
			'@typescript-eslint/require-await': 'error',
			'@typescript-eslint/switch-exhaustiveness-check': 'error'
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
	}
];
