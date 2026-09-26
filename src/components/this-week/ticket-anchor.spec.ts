import { describe, expect, it } from 'vitest';
import { ticketAnchor } from './ticket-anchor';

// Written from the label a reader sees ("Ready now 01"), so a link built from
// that label and the row it lands on can't drift apart.
describe('ticketAnchor', () => {
	it('names a line by its group and its two-digit number', () => {
		expect(ticketAnchor('Ready now', 1)).toBe('ready-now-01');
		expect(ticketAnchor('Approaching', 3)).toBe('approaching-03');
		expect(ticketAnchor('Held back', 12)).toBe('held-back-12');
	});
});
