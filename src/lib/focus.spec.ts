import { describe, expect, it } from 'vitest';
import { FOCUS_RING } from './focus';

describe('focus ring', () => {
	// The defect this constant exists to prevent was a nav link with no ring
	// utility at all, so the assertion is on the ring being drawn rather than on
	// the exact class string, which is free to change.
	it('draws a ring with an offset', () => {
		expect(FOCUS_RING).toContain('focus-visible:ring-2');
		expect(FOCUS_RING).toContain('focus-visible:ring-offset-2');
	});

	// A bare `focus:` ring fires on mouse clicks too, and a ring sighted users
	// learn to ignore is one the keyboard user stops getting credit for.
	it('fires on focus-visible only, never on plain focus', () => {
		expect(FOCUS_RING).not.toMatch(/(?:^|\s)focus:/);
	});

	// Without this the UA outline draws underneath the ring at a contrast the
	// critique measured at 3.32:1, which is the treatment being replaced.
	it('suppresses the UA outline it replaces', () => {
		expect(FOCUS_RING).toContain('outline-none');
	});
});
