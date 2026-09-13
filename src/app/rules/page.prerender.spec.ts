// @vitest-environment node

// `output: 'export'` (next.config.ts) makes `next build` prerender this route
// in Node. page.spec.tsx already proves no clock reading reaches the exported
// markup, by rendering through `renderToStaticMarkup` under jsdom—but jsdom
// ships a `document`, so that spec cannot show the import itself surviving
// Node's absence of one. This spec proves the narrower thing jsdom can't: the
// module, `'use client'` directive and all, imports without error under the
// environment the build actually runs in.
import { describe, expect, it } from 'vitest';
import RulesPage from './page';

describe('rules page in a Node environment', () => {
	it('imports cleanly during the Node prerender', () => {
		// Fails loudly if the pragma above ever stops taking effect.
		expect(typeof document).toBe('undefined');

		expect(typeof RulesPage).toBe('function');
	});
});
