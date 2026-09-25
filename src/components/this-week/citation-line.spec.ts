import type { Rule } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { seedRules } from '@/seed';
import { citationLine } from './citation-line';

function seedRule(id: string): Rule {
	const rule = seedRules.find(candidate => candidate.id === id);
	if (rule === undefined) {
		throw new Error(`the seed rule set no longer carries '${id}'`);
	}
	return rule;
}

describe('citationLine', () => {
	// The owner decides by the close date. The Plan's date inside the window only
	// proves the Rule fired, and two Window rows used to read identically.
	it('leads a Window line with the day the window closes', () => {
		const line = citationLine({ kind: 'window', date: '2026-09-25' }, seedRule('fall-pre-emergent'));

		expect(line).toBe('Window closes Sep 30 / opened Aug 20');
	});

	// A Task whose Rule has left the rule set still renders its evidence, from
	// the Citation alone.
	it('falls back to the Plan date when the Rule is missing', () => {
		expect(citationLine({ kind: 'window', date: '2026-09-25' })).toBe('Window / Sep 25 2026');
	});

	it('says there is nothing to count from when a Cadence Rule has no record', () => {
		expect(citationLine({ kind: 'cadence', lastOccurrenceId: null, elapsedDays: null })).toBe('No earlier record');
	});
});
