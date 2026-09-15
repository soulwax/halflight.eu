import type { Preview } from '@storybook/sveltekit';
import { getThemeLabel, THEMES, type Theme } from '../src/lib/theme.js';
// Global design tokens: every story renders through real components whose
// scoped styles reference these custom properties (--action, --radius-md,
// …). Without this import a story mounts with every var() unresolved —
// SvelteKit's own root layout is what loads this for the real app, but
// Storybook never runs through it. Import errors here fail every story.
import '../src/routes/layout.css';

/**
 * A theme switcher in the toolbar, built from the same registry the real
 * Appearance settings picker uses (`#lib/theme.ts`) — adding a theme there
 * makes it appear here too, with no separate Storybook-specific list to
 * keep in sync.
 */
const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i
			}
		},

		a11y: {
			// 'todo' - show a11y violations in the test UI only
			// 'error' - fail CI on a11y violations
			// 'off' - skip a11y checks entirely
			test: 'todo'
		}
	},

	initialGlobals: {
		theme: 'dark' satisfies Theme
	},

	globalTypes: {
		theme: {
			description: 'Halflight theme',
			toolbar: {
				title: 'Theme',
				icon: 'paintbrush',
				items: THEMES.map((theme) => ({ value: theme, title: getThemeLabel(theme).name })),
				dynamicTitle: true
			}
		}
	},

	decorators: [
		(Story, context) => {
			if (typeof document !== 'undefined') {
				document.documentElement.dataset.theme = String(context.globals.theme ?? 'dark');
			}
			return Story();
		}
	]
};

export default preview;
