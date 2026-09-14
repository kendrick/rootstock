import type { WindowRule } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { citationSchema } from './task';
import { evaluateWindowRule } from './window-rule';

/**
 * A minimal, schema-shaped Window Rule with every field a real one would
 * carry except `start`/`end`, which each test sets to the range it means to
 * exercise. Building it by hand rather than importing one from
 * `fixtures.ts` keeps this spec's ranges under its own control—the fixture
 * file's `fall-pre-emergent` and `winter-mulch-refresh` are shaped around
 * September 2026, not around the boundary and wrap dates this file needs to
 * pin exactly.
 */
function buildWindowRule(start: string, end: string): WindowRule {
	return {
		id: 'fall-pre-emergent',
		name: 'Fall pre-emergent on the front lawn',
		kind: 'window',
		region: { name: 'Fort Worth', hardinessZone: '8b' },
		source: { kind: 'extension', label: 'Texas A&M AgriLife Extension', url: null },
		tags: ['lawn', 'pre-emergent'],
		delegable: true,
		priority: 10,
		appliesTo: { plantIds: ['front-lawn'], plantTags: null, ruleTags: null },
		productLabel: null,
		start,
		end,
	};
}

describe('evaluateWindowRule', () => {
	describe('a normal range', () => {
		const rule = buildWindowRule('09-01', '09-30');

		it('fires for a date inside the range', () => {
			const verdict = evaluateWindowRule(rule, '2026-09-15');

			expect(verdict).toEqual({
				fires: true,
				status: 'fired',
				citation: { kind: 'window', date: '2026-09-15' },
				titleSuffix: null,
			});
		});

		it('does not fire for a date outside the range', () => {
			expect(evaluateWindowRule(rule, '2026-07-04')).toEqual({ fires: false });
		});

		it('fires on the start boundary, inclusive', () => {
			const verdict = evaluateWindowRule(rule, '2026-09-01');

			expect(verdict).toEqual({
				fires: true,
				status: 'fired',
				citation: { kind: 'window', date: '2026-09-01' },
				titleSuffix: null,
			});
		});

		it('fires on the end boundary, inclusive', () => {
			const verdict = evaluateWindowRule(rule, '2026-09-30');

			expect(verdict).toEqual({
				fires: true,
				status: 'fired',
				citation: { kind: 'window', date: '2026-09-30' },
				titleSuffix: null,
			});
		});

		it('does not fire the day before the start boundary', () => {
			expect(evaluateWindowRule(rule, '2026-08-31')).toEqual({ fires: false });
		});

		it('does not fire the day after the end boundary', () => {
			expect(evaluateWindowRule(rule, '2026-10-01')).toEqual({ fires: false });
		});
	});

	describe('a range that wraps the year end', () => {
		const rule = buildWindowRule('12-01', '02-28');

		it('fires in December', () => {
			const verdict = evaluateWindowRule(rule, '2026-12-15');

			expect(verdict).toEqual({
				fires: true,
				status: 'fired',
				citation: { kind: 'window', date: '2026-12-15' },
				titleSuffix: null,
			});
		});

		it('fires in January', () => {
			const verdict = evaluateWindowRule(rule, '2027-01-15');

			expect(verdict).toEqual({
				fires: true,
				status: 'fired',
				citation: { kind: 'window', date: '2027-01-15' },
				titleSuffix: null,
			});
		});

		it('does not fire in June, inside the gap the wrap leaves open', () => {
			expect(evaluateWindowRule(rule, '2026-06-15')).toEqual({ fires: false });
		});
	});

	it('returns a citation that parses through citationSchema', () => {
		const rule = buildWindowRule('09-01', '09-30');
		const verdict = evaluateWindowRule(rule, '2026-09-11');

		if (!verdict.fires) {
			throw new Error('expected the rule to fire for this test to be meaningful');
		}

		expect(verdict.citation).toEqual({ kind: 'window', date: '2026-09-11' });
		expect(citationSchema.parse(verdict.citation)).toEqual(verdict.citation);
	});
});
