import type { Occurrence } from './occurrence';
import type { CadenceRule } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { cadenceRuleSchema } from '@/rules/rule';
import { evaluateCadenceRule } from './cadence-rule';
import { asOf, occurrences as fixtureOccurrences, rules as fixtureRules, timeZone } from './fixtures';
import { occurrenceSchema } from './occurrence';
import { citationSchema } from './task';

const region = { name: 'Fort Worth', hardinessZone: '8b' };
const ownerSource = { kind: 'owner' as const, label: 'House practice', url: null };

/**
 * Every field a Cadence Rule needs but no single test cares about, so each
 * test only spells out the `everyDays`, `season`, or `after` shape it is
 * actually exercising. Parsed rather than asserted with a type annotation, so
 * a fixture that drifts from `cadenceRuleSchema` fails here instead of
 * surfacing as a confusing failure inside `evaluateCadenceRule`.
 */
function buildRule(overrides: Partial<CadenceRule> = {}): CadenceRule {
	return cadenceRuleSchema.parse({
		id: 'test-cadence',
		name: 'Test cadence rule',
		kind: 'cadence',
		region,
		source: ownerSource,
		tags: [],
		delegable: true,
		priority: 0,
		appliesTo: { plantIds: null, plantTags: null, ruleTags: null },
		productLabel: null,
		everyDays: { min: 10, max: 20 },
		season: null,
		after: null,
		...overrides,
	});
}

function buildOccurrence(overrides: Partial<Occurrence> = {}): Occurrence {
	return occurrenceSchema.parse({
		id: 'test-occurrence',
		ruleId: 'test-cadence',
		plantId: null,
		completedAt: '2026-01-01T00:00:00Z',
		recordedAt: '2026-01-01T00:00:00Z',
		source: 'seed',
		...overrides,
	});
}

/** Narrows a fixture Rule to CadenceRule, so a test reads `.everyDays` without a cast. */
function findFixtureCadenceRule(id: string): CadenceRule {
	const rule = fixtureRules.find(candidate => candidate.id === id);
	if (rule === undefined) {
		throw new Error(`fixture rule '${id}' not found`);
	}
	if (rule.kind !== 'cadence') {
		throw new Error(`fixture rule '${id}' is not a cadence rule`);
	}
	return rule;
}

describe('evaluateCadenceRule', () => {
	it('fires exactly at everyDays.min', () => {
		const rule = buildRule({ everyDays: { min: 10, max: 20 } });
		const anchor = buildOccurrence({ completedAt: '2026-01-01T00:00:00Z' });

		const verdict = evaluateCadenceRule(rule, null, [anchor], '2026-01-11', 'UTC');

		expect(verdict).toEqual({
			fires: true,
			status: 'fired',
			titleSuffix: null,
			citation: { kind: 'cadence', lastOccurrenceId: 'test-occurrence', elapsedDays: 10 },
		});
	});

	it('stays silent one day short of everyDays.min', () => {
		const rule = buildRule({ everyDays: { min: 10, max: 20 } });
		const anchor = buildOccurrence({ completedAt: '2026-01-01T00:00:00Z' });

		const verdict = evaluateCadenceRule(rule, null, [anchor], '2026-01-10', 'UTC');

		expect(verdict).toEqual({ fires: false });
	});

	it('leaves titleSuffix null right up to and including everyDays.max', () => {
		const rule = buildRule({ everyDays: { min: 10, max: 20 } });
		const anchor = buildOccurrence({ completedAt: '2026-01-01T00:00:00Z' });

		// elapsed === max is the boundary the "overdue" comparison must not tip on.
		const verdict = evaluateCadenceRule(rule, null, [anchor], '2026-01-21', 'UTC');

		expect(verdict).toEqual({
			fires: true,
			status: 'fired',
			titleSuffix: null,
			citation: { kind: 'cadence', lastOccurrenceId: 'test-occurrence', elapsedDays: 20 },
		});
	});

	it('marks the title overdue the day past everyDays.max', () => {
		const rule = buildRule({ everyDays: { min: 10, max: 20 } });
		const anchor = buildOccurrence({ completedAt: '2026-01-01T00:00:00Z' });

		const verdict = evaluateCadenceRule(rule, null, [anchor], '2026-01-22', 'UTC');

		expect(verdict).toEqual({
			fires: true,
			status: 'fired',
			titleSuffix: 'overdue',
			citation: { kind: 'cadence', lastOccurrenceId: 'test-occurrence', elapsedDays: 21 },
		});
	});

	it('fires with null citation fields when there is no history and no after', () => {
		const rule = buildRule({ after: null });

		const verdict = evaluateCadenceRule(rule, null, [], '2026-01-01', 'UTC');

		expect(verdict).toEqual({
			fires: true,
			status: 'fired',
			titleSuffix: 'never recorded',
			citation: { kind: 'cadence', lastOccurrenceId: null, elapsedDays: null },
		});
	});

	it('stays silent when after is set and unanchored', () => {
		const rule = buildRule({ after: { ruleId: 'other-rule' } });

		const verdict = evaluateCadenceRule(rule, null, [], '2026-01-01', 'UTC');

		expect(verdict).toEqual({ fires: false });
	});

	it('uses fixture data: fall-pre-emergent-split has no occurrence behind it and stays silent', () => {
		const rule = findFixtureCadenceRule('fall-pre-emergent-split');

		const verdict = evaluateCadenceRule(rule, 'front-lawn', fixtureOccurrences, asOf, timeZone);

		expect(verdict).toEqual({ fires: false });
	});

	it('counts an after rule from the rule it follows, not from its own occurrences', () => {
		const rule = buildRule({ id: 'second-half', everyDays: { min: 10, max: 20 }, after: { ruleId: 'first-half' } });
		const ownOccurrence = buildOccurrence({ id: 'second-half-recent', ruleId: 'second-half', completedAt: '2026-01-19T00:00:00Z' });
		const followedOccurrence = buildOccurrence({ id: 'first-half-anchor', ruleId: 'first-half', completedAt: '2026-01-01T00:00:00Z' });

		// If the rule wrongly counted from its own occurrence, elapsed would be 1
		// day (below min) instead of 10, so a firing verdict here proves the
		// anchor came from `first-half`.
		const verdict = evaluateCadenceRule(rule, null, [ownOccurrence, followedOccurrence], '2026-01-11', 'UTC');

		expect(verdict).toEqual({
			fires: true,
			status: 'fired',
			titleSuffix: null,
			citation: { kind: 'cadence', lastOccurrenceId: 'first-half-anchor', elapsedDays: 10 },
		});
	});

	it('does not let an occurrence for a different plant stand in as the anchor', () => {
		const rule = buildRule({ everyDays: { min: 10, max: 20 } });
		const ownPlantOccurrence = buildOccurrence({ id: 'plant-a-occurrence', plantId: 'plant-a', completedAt: '2026-01-01T00:00:00Z' });
		const otherPlantOccurrence = buildOccurrence({ id: 'plant-b-occurrence', plantId: 'plant-b', completedAt: '2026-01-15T00:00:00Z' });

		// If the newer plant-b occurrence were picked, elapsed would fall short
		// of min and the rule would stay silent instead of firing at 10 days.
		const verdict = evaluateCadenceRule(rule, 'plant-a', [ownPlantOccurrence, otherPlantOccurrence], '2026-01-11', 'UTC');

		expect(verdict).toEqual({
			fires: true,
			status: 'fired',
			titleSuffix: null,
			citation: { kind: 'cadence', lastOccurrenceId: 'plant-a-occurrence', elapsedDays: 10 },
		});
	});

	it('anchors on the latest of several matching occurrences', () => {
		const rule = buildRule({ everyDays: { min: 10, max: 20 } });
		const earliest = buildOccurrence({ id: 'earliest', completedAt: '2025-12-01T00:00:00Z' });
		const latest = buildOccurrence({ id: 'latest', completedAt: '2026-01-05T00:00:00Z' });
		const middle = buildOccurrence({ id: 'middle', completedAt: '2026-01-01T00:00:00Z' });

		const verdict = evaluateCadenceRule(rule, null, [earliest, latest, middle], '2026-01-15', 'UTC');

		expect(verdict).toEqual({
			fires: true,
			status: 'fired',
			titleSuffix: null,
			citation: { kind: 'cadence', lastOccurrenceId: 'latest', elapsedDays: 10 },
		});
	});

	it('uses fixture data: the latest esperanza-feeding occurrence wins over the earlier one', () => {
		const rule = findFixtureCadenceRule('esperanza-feeding');

		const verdict = evaluateCadenceRule(rule, 'esperanza-1', fixtureOccurrences, asOf, timeZone);

		expect(verdict).toEqual({
			fires: true,
			status: 'fired',
			titleSuffix: null,
			citation: { kind: 'cadence', lastOccurrenceId: 'esperanza-feeding-2026-08-02', elapsedDays: 40 },
		});
	});

	it('stays silent when asOf falls outside a non-wrapping season', () => {
		const rule = buildRule({ season: { start: '03-15', end: '10-05' } });
		const anchor = buildOccurrence({ completedAt: '2025-01-01T00:00:00Z' });

		const verdict = evaluateCadenceRule(rule, null, [anchor], '2026-11-01', 'UTC');

		expect(verdict).toEqual({ fires: false });
	});

	it('stays silent when asOf falls in the gap of a season that wraps the year end', () => {
		const rule = buildRule({ season: { start: '11-15', end: '02-15' } });
		const anchor = buildOccurrence({ completedAt: '2025-01-01T00:00:00Z' });

		const verdict = evaluateCadenceRule(rule, null, [anchor], '2026-06-01', 'UTC');

		expect(verdict).toEqual({ fires: false });
	});

	it('fires normally when asOf falls inside a season that wraps the year end', () => {
		const rule = buildRule({ season: { start: '11-15', end: '02-15' }, everyDays: { min: 10, max: 20 } });
		const anchor = buildOccurrence({ completedAt: '2025-12-22T00:00:00Z' });

		const verdict = evaluateCadenceRule(rule, null, [anchor], '2026-01-01', 'UTC');

		expect(verdict).toEqual({
			fires: true,
			status: 'fired',
			titleSuffix: null,
			citation: { kind: 'cadence', lastOccurrenceId: 'test-occurrence', elapsedDays: 10 },
		});
	});

	it('produces a citation that parses through citationSchema for every firing shape', () => {
		const neverRecorded = evaluateCadenceRule(buildRule(), null, [], '2026-01-01', 'UTC');
		const withHistory = evaluateCadenceRule(
			buildRule({ everyDays: { min: 10, max: 20 } }),
			null,
			[buildOccurrence({ completedAt: '2026-01-01T00:00:00Z' })],
			'2026-01-22',
			'UTC',
		);

		for (const verdict of [neverRecorded, withHistory]) {
			if (!verdict.fires) {
				throw new Error('expected this verdict to fire');
			}
			expect(() => citationSchema.parse(verdict.citation)).not.toThrow();
		}
	});
});
