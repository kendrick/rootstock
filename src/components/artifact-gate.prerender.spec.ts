// @vitest-environment node

// Every route wraps its content in ArtifactGate before anything below it can
// render, and `next build` prerenders every route in Node under
// `output: 'export'`. The `'use client'` directive at the top of
// artifact-gate.tsx is inert under Node—Next only honors it once it is
// bundling for the browser—so the only thing left to prove here is that the
// module still imports cleanly with `'use client'` in place and nothing on
// the way reaching for a DOM global.
import { describe, expect, it } from 'vitest';
import { ArtifactGate } from './artifact-gate';

describe('artifactGate in a Node environment', () => {
	it('imports cleanly during the Node prerender', () => {
		// Fails loudly if the pragma above ever stops taking effect.
		expect(typeof document).toBe('undefined');

		expect(typeof ArtifactGate).toBe('function');
	});
});
