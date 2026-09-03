import { vi } from 'vitest';

// Component singletons (`player`, `customPlaylists`, `themeManager`) fire
// background `fetch` calls on construction. In a component test there is no
// server, and a late-resolving fetch re-renders mid-assertion. Stub it to fail
// fast and predictably; individual specs can still override with vi.stubGlobal.
vi.stubGlobal(
	'fetch',
	vi.fn(() => Promise.reject(new Error('fetch disabled in component tests')))
);
