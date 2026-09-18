import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { mdsvex } from 'mdsvex';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import vercelAdapter from '@sveltejs/adapter-vercel';
import nodeAdapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

// `ADAPTER=node pnpm build` produces a standalone Node server in `build/` for the
// self-hosted (PM2) deployment; the default keeps the Vercel serverless target.
const adapter =
	process.env.ADAPTER === 'node' ? nodeAdapter() : vercelAdapter({ runtime: 'nodejs24.x' });

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
				experimental: {
					// Async mode's reactivity wrapper breaks vitest-browser-svelte's
					// polling matchers on any component that reads a `$derived` (or
					// `resolve()`); nothing in the app uses `await` in markup, so it's
					// safe to keep it off under test.
					async: !process.env.VITEST
				}
			},
			adapter,
			preprocess: [
				mdsvex({
					extensions: ['.svx', '.md']
				})
			],
			extensions: ['.svelte', '.svx', '.md'],
			experimental: {
				remoteFunctions: true,
				forkPreloads: true
			}
		}),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true
		})
	],
	test: {
		expect: {
			requireAssertions: true
		},
		/*
		 * The browser projects drive their own Chromium pools. Browser specs stub
		 * global APIs such as fetch, Audio and timers, so the client project runs
		 * serially; that keeps one spec's playback mock from changing another
		 * spec's metadata requests. Storybook remains separately bounded. The root
		 * limit keeps node-only work bounded.
		 */
		maxWorkers: 3,
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					// Browser specs replace process-wide browser APIs such as fetch,
					// Audio and timers. Run them in one worker so a playback mock or
					// fake clock cannot leak into a concurrently executing component.
					maxWorkers: 1,
					sequence: { groupOrder: 1 },
					browser: {
						enabled: true,
						provider: playwright(),
						// Wide enough that responsive `display:none` columns still render.
						viewport: { width: 1280, height: 900 },
						instances: [
							{
								browser: 'chromium',
								headless: true
							}
						]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./src/vitest-setup-client.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					sequence: { groupOrder: 2 },
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				extends: true,
				plugins: [
					// The plugin will run tests for the stories defined in your Storybook config
					// See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
					storybookTest({
						configDir: path.join(import.meta.dirname, '.storybook')
					})
				],
				test: {
					name: 'storybook',
					maxWorkers: 1,
					sequence: { groupOrder: 3 },
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [
							{
								browser: 'chromium'
							}
						]
					}
				}
			}
		]
	}
});
