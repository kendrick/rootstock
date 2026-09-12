import type { DailyAggregate } from './plan';
import type { RuleVerdict } from './planner';
import type { Citation } from './task';
import type { ThresholdRule } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { thresholdRuleSchema } from '@/rules/rule';
import { toDailyAggregates } from './aggregate';
import { asOf as fixtureAsOf, observations, rules, timeZone } from './fixtures';
import { dailyAggregateSchema } from './plan';
import { citationSchema } from './task';
import { evaluateThresholdRule } from './threshold-rule';

/*
 * Every Rule below is built through the real schema and every day through the
 * real one too, so a field that stops existing breaks this file where the
 * fixture is written rather than at whichever assertion happened to read it.
 */
const ruleTemplate = {
	id: 'local-threshold',
	name: 'Local threshold',
	kind: 'threshold',
	region: { name: 'Fort Worth', hardinessZone: '8b' },
	source: { kind: 'owner', label: 'House practice', url: null },
	tags: [],
	delegable: true,
	priority: 1,
	appliesTo: { plantIds: null, plantTags: null, ruleTags: null },
	productLabel: null,
	variable: 'soil-temperature',
	depthCm: 6,
	aggregate: 'mean',
	comparison: 'lte',
	value: 70,
	unit: 'F',
	consecutiveDays: 3,
	published: null,
};

function rule(fields: Partial<ThresholdRule> = {}): ThresholdRule {
	return thresholdRuleSchema.parse({ ...ruleTemplate, ...fields });
}

const dayTemplate = {
	variable: 'soil-temperature',
	depthCm: 6,
	aggregate: 'mean',
	unit: 'F',
	basis: 'observed',
	provenance: 'modeled',
	source: 'open-meteo',
};

function day(date: string, value: number, fields: Partial<DailyAggregate> = {}): DailyAggregate {
	return dailyAggregateSchema.parse({ ...dayTemplate, date, value, ...fields });
}

function forecast(date: string, value: number, fields: Partial<DailyAggregate> = {}): DailyAggregate {
	return day(date, value, { basis: 'forecast', ...fields });
}

/**
 * Pulls the Citation out of a verdict and runs it through the schema on the
 * way. Every Citation this file inspects passes through here, so a Citation
 * that stops parsing fails the test that reads it instead of waiting for the
 * one at the bottom that checks parsing on purpose.
 */
function citationOf(verdict: RuleVerdict): Citation {
	if (!verdict.fires) {
		throw new Error('expected the Rule to fire, but the verdict was { fires: false }');
	}
	return citationSchema.parse(verdict.citation);
}

/**
 * `fall-pre-emergent-soil` out of the committed fixtures, narrowed by its own
 * `kind` discriminator, so re-authoring that fixture as another Rule kind
 * fails here by name instead of somewhere further down.
 */
function fixtureRule(): ThresholdRule {
	const found = rules.find(candidate => candidate.id === 'fall-pre-emergent-soil');
	if (found === undefined || found.kind !== 'threshold') {
		throw new Error('planner fixtures no longer hold the Threshold Rule this spec is built on');
	}
	return found;
}

describe('evaluateThresholdRule', () => {
	it('fires on the committed fixture series and cites the three days that crossed', () => {
		/*
		 * The fixture's soil series is shaped so that exactly the last three
		 * days sit at or below 70F. Reducing it here gives the same window the
		 * Planner will hand over, probe day and all, where hand-written daily
		 * figures would only restate what this spec hopes the reduction did.
		 */
		const window = toDailyAggregates(observations, timeZone, 'mean');

		const verdict = evaluateThresholdRule(fixtureRule(), window, fixtureAsOf);

		expect(verdict).toMatchObject({ fires: true, status: 'fired', titleSuffix: null });
		expect(citationOf(verdict)).toEqual({
			kind: 'threshold',
			variable: 'soil-temperature',
			depthCm: 6,
			aggregate: 'mean',
			from: '2026-09-09',
			to: '2026-09-11',
		});
	});

	it('fires a gte Rule when the series holds at or above the value', () => {
		const warming = rule({ comparison: 'gte', value: 55, consecutiveDays: 3 });
		const window = [
			day('2026-03-01', 52),
			day('2026-03-02', 55),
			day('2026-03-03', 57),
			day('2026-03-04', 58),
		];

		const verdict = evaluateThresholdRule(warming, window, '2026-03-04');

		expect(verdict).toMatchObject({ fires: true, status: 'fired' });
		expect(citationOf(verdict)).toMatchObject({ from: '2026-03-02', to: '2026-03-04' });
	});

	/*
	 * The property the module exists to protect. A fired Task claims the yard
	 * already crossed the line, and a forecast makes no such claim however many
	 * days of it line up.
	 */
	it('never fires on a run made only of forecast days, under lte', () => {
		const window = [
			day('2026-09-09', 73),
			day('2026-09-10', 72),
			day('2026-09-11', 71),
			forecast('2026-09-12', 69),
			forecast('2026-09-13', 68),
			forecast('2026-09-14', 67),
		];

		const verdict = evaluateThresholdRule(rule(), window, '2026-09-11');

		expect(verdict).toMatchObject({ fires: true, status: 'approaching' });
		expect(verdict).not.toMatchObject({ status: 'fired' });
		expect(citationOf(verdict)).toEqual({
			kind: 'threshold-projection',
			variable: 'soil-temperature',
			depthCm: 6,
			aggregate: 'mean',
			projectedDate: '2026-09-14',
		});
	});

	it('never fires on a run made only of forecast days, under gte', () => {
		const warming = rule({ comparison: 'gte', value: 55, consecutiveDays: 3 });
		const window = [
			day('2026-03-01', 50),
			day('2026-03-02', 51),
			day('2026-03-03', 52),
			forecast('2026-03-04', 56),
			forecast('2026-03-05', 57),
			forecast('2026-03-06', 58),
		];

		const verdict = evaluateThresholdRule(warming, window, '2026-03-03');

		expect(verdict).toMatchObject({ fires: true, status: 'approaching' });
		expect(verdict).not.toMatchObject({ status: 'fired' });
		expect(citationOf(verdict)).toMatchObject({ projectedDate: '2026-03-06' });
	});

	it('stays fired on an earlier run that later days no longer satisfy', () => {
		// Soil that settled below 70F for three days in the first week did not
		// un-settle because the second week ran warm. The Citation names the
		// crossing that happened, not the days nearest the as-of date.
		const window = [
			day('2026-09-01', 74),
			day('2026-09-02', 69),
			day('2026-09-03', 68),
			day('2026-09-04', 67),
			day('2026-09-05', 76),
			day('2026-09-06', 78),
			day('2026-09-07', 79),
		];

		const verdict = evaluateThresholdRule(rule(), window, '2026-09-07');

		expect(verdict).toMatchObject({ fires: true, status: 'fired' });
		expect(citationOf(verdict)).toMatchObject({ from: '2026-09-02', to: '2026-09-04' });
	});

	it('breaks a run on a date missing from the series entirely', () => {
		const satisfying = [day('2026-09-01', 68), day('2026-09-02', 67), day('2026-09-04', 66)];

		expect(evaluateThresholdRule(rule(), satisfying, '2026-09-04')).toEqual({ fires: false });

		// The same three days plus the one that was missing: proof the gap did
		// the breaking, and not something else about this series.
		const filled = [...satisfying, day('2026-09-03', 66)];
		const verdict = evaluateThresholdRule(rule(), filled, '2026-09-04');

		expect(verdict).toMatchObject({ fires: true, status: 'fired' });
		expect(citationOf(verdict)).toMatchObject({ from: '2026-09-01', to: '2026-09-03' });
	});

	it('projects the day a run closes when it opens on observed days and closes on forecast ones', () => {
		const window = [
			day('2026-09-09', 74),
			day('2026-09-10', 69),
			day('2026-09-11', 68),
			forecast('2026-09-12', 67),
			forecast('2026-09-13', 66),
		];

		const verdict = evaluateThresholdRule(rule(), window, '2026-09-11');

		expect(verdict).toMatchObject({ fires: true, status: 'approaching', titleSuffix: null });
		expect(citationOf(verdict)).toMatchObject({ projectedDate: '2026-09-12' });
	});

	/*
	 * A window can carry a forecast row for a day that has already happened,
	 * left behind by an earlier fetch. Counting one would date a crossing in
	 * the past, and `projectedDate` is a promise about a day still to come, so
	 * the stale rows drop out before the projection is scanned. Here the only
	 * run available is made of them.
	 */
	it('never projects a crossing onto a day that has already passed', () => {
		const window = [
			forecast('2026-09-06', 68),
			forecast('2026-09-07', 67),
			forecast('2026-09-08', 66),
			day('2026-09-09', 74),
			day('2026-09-10', 75),
			day('2026-09-11', 76),
		];

		expect(evaluateThresholdRule(rule(), window, '2026-09-11')).toEqual({ fires: false });
	});

	it('still projects a crossing that closes on the as-of day itself', () => {
		const window = [
			day('2026-09-09', 69),
			day('2026-09-10', 68),
			forecast('2026-09-11', 67),
		];

		const verdict = evaluateThresholdRule(rule(), window, '2026-09-11');

		expect(verdict).toMatchObject({ fires: true, status: 'approaching' });
		expect(citationOf(verdict)).toMatchObject({ projectedDate: '2026-09-11' });
	});

	it('does not fire a series shorter than the run the Rule asks for', () => {
		// Four satisfying days against a Rule that wants five. ADR 0003 forbids
		// shortening the Rule to fit the window, so the answer here is no
		// verdict at all.
		const patient = rule({ consecutiveDays: 5 });
		const window = [
			day('2026-09-08', 68),
			day('2026-09-09', 67),
			day('2026-09-10', 66),
			day('2026-09-11', 65),
		];

		expect(evaluateThresholdRule(patient, window, '2026-09-11')).toEqual({ fires: false });
	});

	it('ignores days belonging to another variable', () => {
		const window = [
			day('2026-09-09', 10, { variable: 'precipitation-probability', depthCm: null, unit: 'percent' }),
			day('2026-09-10', 10, { variable: 'precipitation-probability', depthCm: null, unit: 'percent' }),
			day('2026-09-11', 10, { variable: 'precipitation-probability', depthCm: null, unit: 'percent' }),
		];

		expect(evaluateThresholdRule(rule(), window, '2026-09-11')).toEqual({ fires: false });
	});

	it('ignores the same variable taken at another depth', () => {
		// null and 6 are different series. A Rule written for 6cm that counted
		// surface days would cite numbers nobody ever compared.
		const window = [
			day('2026-09-09', 66, { depthCm: null }),
			day('2026-09-10', 65, { depthCm: null }),
			day('2026-09-11', 64, { depthCm: null }),
			day('2026-09-09', 74, { depthCm: 12 }),
			day('2026-09-10', 73, { depthCm: 12 }),
			day('2026-09-11', 72, { depthCm: 12 }),
		];

		expect(evaluateThresholdRule(rule(), window, '2026-09-11')).toEqual({ fires: false });
	});

	it('ignores the same series reduced by another aggregate', () => {
		const window = [
			day('2026-09-09', 66, { aggregate: 'min' }),
			day('2026-09-10', 65, { aggregate: 'min' }),
			day('2026-09-11', 64, { aggregate: 'min' }),
		];

		expect(evaluateThresholdRule(rule(), window, '2026-09-11')).toEqual({ fires: false });
	});

	it('returns no verdict for an empty window rather than throwing', () => {
		expect(evaluateThresholdRule(rule(), [], '2026-09-11')).toEqual({ fires: false });
	});

	it('does not count an observed day dated past the as-of date toward firing', () => {
		// A Planner run for the 10th has not reached the 11th yet, whatever the
		// day's own basis claims.
		const window = [day('2026-09-09', 68), day('2026-09-10', 67), day('2026-09-11', 66)];

		const verdict = evaluateThresholdRule(rule(), window, '2026-09-10');

		expect(verdict).toMatchObject({ fires: true, status: 'approaching' });
		expect(citationOf(verdict)).toMatchObject({ projectedDate: '2026-09-11' });
	});

	it('sorts the series itself instead of trusting the order it was handed', () => {
		const window = [day('2026-09-11', 66), day('2026-09-09', 68), day('2026-09-10', 67)];
		const asHanded = [...window];

		const verdict = evaluateThresholdRule(rule(), window, '2026-09-11');

		expect(citationOf(verdict)).toMatchObject({ from: '2026-09-09', to: '2026-09-11' });
		expect(window).toEqual(asHanded);
	});

	it('returns a Citation that parses, on both the fired and the approaching path', () => {
		const fired = evaluateThresholdRule(rule(), [
			day('2026-09-09', 68),
			day('2026-09-10', 67),
			day('2026-09-11', 66),
		], '2026-09-11');

		const approaching = evaluateThresholdRule(rule(), [
			day('2026-09-09', 74),
			forecast('2026-09-10', 67),
			forecast('2026-09-11', 66),
			forecast('2026-09-12', 65),
		], '2026-09-09');

		expect(citationOf(fired).kind).toBe('threshold');
		expect(citationOf(approaching).kind).toBe('threshold-projection');
	});
});
