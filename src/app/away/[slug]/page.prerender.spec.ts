// @vitest-environment node

// `output: 'export'` leaves no server behind, so `next build` calls
// `generateStaticParams` and prerenders this route in Node—the one page in
// the app that is a server component rather than a client boundary (see the
// docblock above `AwayPage`). page.spec.tsx already covers what happens when
// `ROOTSTOCK_AWAY_SLUG` is missing or blank; this spec makes no claim about
// that variable at all, since `requireAwaySlug` only runs inside
// `generateStaticParams`, never at module scope. It only proves the module
// imports cleanly and that its three exports are what a page module needs
// them to be.
import { describe, expect, it } from 'vitest';
import AwayPage, { dynamicParams, generateStaticParams } from './page';

describe('away page in a Node environment', () => {
	it('imports cleanly during the Node prerender', () => {
		// Fails loudly if the pragma above ever stops taking effect.
		expect(typeof document).toBe('undefined');

		expect(typeof AwayPage).toBe('function');
		expect(typeof generateStaticParams).toBe('function');
		expect(dynamicParams).toBe(false);
	});
});
