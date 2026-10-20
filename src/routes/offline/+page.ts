// This public response is rendered at request time so the locale middleware
// can produce the matching recovery copy before the service worker caches it.
export const prerender = false;
// The recovery page is fully server-rendered; its retry link works without
// fetching the mobile app's JavaScript while the device is offline.
export const csr = false;
