// @vitest-environment node

// `next build` prerenders every route in Node (see the docblock on
// `openBrowserStore` in ./browser.ts), and every route reaches `seedStore`
// through `@/seed` on the way. browser.spec.ts already proves the module
// never touches `globalThis.indexedDB` on import, but it does so against a
// mocked `@/seed`—it never exercises the real seed pipeline that a prerender
// actually runs. This spec imports the real module, real seed JSON included,
// so a schema change or a stray browser-global read on that path fails here
// rather than at the next `next build`.
import { describe, expect, it } from 'vitest';
import { listOccurrences, openBrowserStore, seedStore } from './browser';

describe('browser store in a Node environment', () => {
	it('builds the real seedStore without a browser to read', () => {
		// Fails loudly if the pragma above ever stops taking effect.
		expect(typeof document).toBe('undefined');

		expect(typeof seedStore.list).toBe('function');
		expect(typeof openBrowserStore).toBe('function');
		expect(typeof listOccurrences).toBe('function');
	});
});
