// Keep a dedicated German fallback artifact: locale path aliases are rerouted
// to their base route during prerendering, so the locale is explicit here.
export const prerender = true;
export const csr = false;
