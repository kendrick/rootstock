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

/**
 * The shipped `spring-pre-emergent` reduced to the fields the evaluator reads:
 * 55F at 6cm over three days, rising. Passing `direction: null` back gives
 * what a seed Rule that names no direction parses to, so the specs below can
 * vary that one field and hold the series still.
 */
function springRule(fields: Partial<ThresholdRule> = {}): ThresholdRule {
	return rule({ comparison: 'gte', value: 55, direction: 'rising', ...fields });
}

/**
 * A February warm spell peaking at 58F, declining on every day of its own run,
 * and collapsing into the low 40s behind a front. Three days hold at or above
 * 55F, which is why a Rule asking only for a threshold reads a crossing in a
 * series that never climbed through one.
 */
const februaryWarmSpell = [
	day('2026-02-08', 58),
	day('2026-02-09', 56),
	day('2026-02-10', 55),
	day('2026-02-11', 47),
	day('2026-02-12', 43),
	day('2026-02-13', 41),
];

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

	/*
	 * A Planner run for the 10th has not reached the 11th, whatever that day's
	 * own basis claims, so the reading cannot fire the Rule. Nor can it project
	 * one: CONTEXT.md says an Approaching Task is one the Rule "is forecast to"
	 * satisfy, and its Citation names a forecast day so that evidence which has
	 * happened is never confused with evidence that is expected. A recorded
	 * reading for the 11th is neither, so the Rule has nothing to say yet.
	 */
	it('neither fires nor projects on an observed day dated past the as-of date', () => {
		const window = [day('2026-09-09', 68), day('2026-09-10', 67), day('2026-09-11', 66)];

		expect(evaluateThresholdRule(rule(), window, '2026-09-10')).toEqual({ fires: false });
	});

	/*
	 * The invariant the two filters buy, asserted directly rather than left to
	 * be inferred from the cases above. Every day that could close a projected
	 * run is a forecast day, so a projection can never cite a reading that has
	 * already happened.
	 */
	it('always names a forecast day as the projected crossing', () => {
		const window = [
			day('2026-09-09', 74),
			day('2026-09-10', 69),
			day('2026-09-11', 68),
			forecast('2026-09-12', 67),
			forecast('2026-09-13', 66),
		];

		const verdict = evaluateThresholdRule(rule(), window, '2026-09-11');
		const citation = citationOf(verdict);

		if (citation.kind !== 'threshold-projection') {
			throw new Error(`expected a projection citation, got '${citation.kind}'`);
		}

		const cited = window.find(entry => entry.date === citation.projectedDate);
		expect(cited?.basis).toBe('forecast');
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

	describe('with a crossing direction', () => {
		it('does not fire a rising Rule on a spell that declines through its own run', () => {
			expect(evaluateThresholdRule(springRule(), februaryWarmSpell, '2026-02-13')).toEqual({ fires: false });
		});

		it('fires that same spell for a Rule naming no direction', () => {
			// The same spell judged on the threshold alone. Pairing the two verdicts
			// shows `direction` doing the work, rather than some other property of a
			// series the evaluator was already unhappy with.
			const verdict = evaluateThresholdRule(springRule({ direction: null }), februaryWarmSpell, '2026-02-13');

			expect(verdict).toMatchObject({ fires: true, status: 'fired' });
			expect(citationOf(verdict)).toMatchObject({ from: '2026-02-08', to: '2026-02-10' });
		});

		it('fires a rising Rule on a run the day before it sat below the value', () => {
			const window = [
				day('2026-03-01', 52),
				day('2026-03-02', 55),
				day('2026-03-03', 57),
				day('2026-03-04', 58),
			];

			const verdict = evaluateThresholdRule(springRule(), window, '2026-03-04');

			expect(verdict).toMatchObject({ fires: true, status: 'fired' });
			expect(citationOf(verdict)).toMatchObject({ from: '2026-03-02', to: '2026-03-04' });
		});

		it('does not fire a directed Rule on a run that opens the series', () => {
			// The window opens on soil already warm, so nothing in it says whether
			// the series climbed through 55F yesterday or settled there a fortnight
			// ago. The undirected verdict on the same days pins the missing evidence
			// as the reason.
			const window = [day('2026-03-01', 56), day('2026-03-02', 57), day('2026-03-03', 58)];

			expect(evaluateThresholdRule(springRule(), window, '2026-03-03')).toEqual({ fires: false });

			const verdict = evaluateThresholdRule(springRule({ direction: null }), window, '2026-03-03');
			expect(citationOf(verdict)).toMatchObject({ from: '2026-03-01', to: '2026-03-03' });
		});

		it('does not fire a directed Rule on a run that opens after a gap in the dates', () => {
			// The 1st reads below the value and would be the crossing if the 2nd
			// were in the series. The 2nd is missing, so the nearest day behind the
			// run sits two days out and proves nothing about the day it opened.
			const window = [
				day('2026-03-01', 52),
				day('2026-03-03', 56),
				day('2026-03-04', 57),
				day('2026-03-05', 58),
			];

			expect(evaluateThresholdRule(springRule(), window, '2026-03-05')).toEqual({ fires: false });

			const verdict = evaluateThresholdRule(springRule({ direction: null }), window, '2026-03-05');
			expect(citationOf(verdict)).toMatchObject({ from: '2026-03-03', to: '2026-03-05' });
		});

		it('does not fire a rising Rule when the day before the run was already past the value', () => {
			// A spell in progress rather than a crossing. The run from the 2nd to
			// the 4th does have a day behind it to read, and that day already sits
			// above 55F.
			const window = [
				day('2026-03-01', 56),
				day('2026-03-02', 57),
				day('2026-03-03', 58),
				day('2026-03-04', 59),
			];

			expect(evaluateThresholdRule(springRule(), window, '2026-03-04')).toEqual({ fires: false });
		});

		it('keeps a rising crossing fired after the series reverses', () => {
			// `direction` decides which runs qualify, not how long a qualified one
			// stands. The front on the 5th reverses the series, and the crossing on
			// the 2nd still happened.
			const window = [
				day('2026-03-01', 52),
				day('2026-03-02', 55),
				day('2026-03-03', 57),
				day('2026-03-04', 58),
				day('2026-03-05', 44),
				day('2026-03-06', 41),
			];

			const verdict = evaluateThresholdRule(springRule(), window, '2026-03-06');

			expect(verdict).toMatchObject({ fires: true, status: 'fired' });
			expect(citationOf(verdict)).toMatchObject({ from: '2026-03-02', to: '2026-03-04' });
		});

		it('still cites the fixture crossing once the fall Rule names its falling direction', () => {
			// The fall case the permanence argument was written about. The fixture's
			// soil reads above 70F the day before the run and at or below it for all
			// three days, so spelling out `falling` costs the Rule nothing.
			const falling = thresholdRuleSchema.parse({ ...fixtureRule(), direction: 'falling' });
			const window = toDailyAggregates(observations, timeZone, 'mean');

			const verdict = evaluateThresholdRule(falling, window, fixtureAsOf);

			expect(verdict).toMatchObject({ fires: true, status: 'fired' });
			expect(citationOf(verdict)).toMatchObject({ from: '2026-09-09', to: '2026-09-11' });
		});

		it('does not project a run the forecast joins from the near side', () => {
			// Approaching claims a crossing is coming. Soil already above the line
			// when the window opens is a spell nobody watched begin, and a forecast
			// that it stays there promises no crossing.
			const window = [
				day('2026-03-08', 56),
				day('2026-03-09', 57),
				forecast('2026-03-10', 58),
				forecast('2026-03-11', 59),
			];

			expect(evaluateThresholdRule(springRule(), window, '2026-03-09')).toEqual({ fires: false });
		});

		it('projects a run the forecast joins from the far side', () => {
			// The day before the run is observed and below the value, so the forecast
			// covers the crossing itself. A forecast day may serve as that prior day
			// too, since `approaching` claims nothing as fact.
			const window = [
				day('2026-03-08', 52),
				day('2026-03-09', 55),
				forecast('2026-03-10', 57),
				forecast('2026-03-11', 58),
			];

			const verdict = evaluateThresholdRule(springRule(), window, '2026-03-09');

			expect(verdict).toMatchObject({ fires: true, status: 'approaching' });
			expect(citationOf(verdict)).toMatchObject({ projectedDate: '2026-03-11' });
		});
	});

	describe('with a season', () => {
		it('says nothing on an as-of date outside the season, whatever the series did', () => {
			const spring = springRule({ season: { start: '02-15', end: '04-30' } });
			const window = [
				day('2026-03-01', 52),
				day('2026-03-02', 55),
				day('2026-03-03', 57),
				day('2026-03-04', 58),
			];

			expect(evaluateThresholdRule(spring, window, '2026-07-04')).toEqual({ fires: false });

			// Same Rule, same days, an as-of date the season holds. The crossing is
			// there to be found either way, and the as-of date is the only thing
			// that changed.
			expect(evaluateThresholdRule(spring, window, '2026-03-04')).toMatchObject({ fires: true, status: 'fired' });
		});

		it('does not count a run that closes before the season opens', () => {
			const winterSpell = [
				day('2026-01-28', 56),
				day('2026-01-29', 57),
				day('2026-01-30', 58),
			];
			const asOf = '2026-02-05';

			const fenced = springRule({ direction: null, season: { start: '02-01', end: '04-30' } });
			expect(evaluateThresholdRule(fenced, winterSpell, asOf)).toEqual({ fires: false });

			// The same three days against a season that opens early enough to hold
			// them. The as-of date sits inside both, so the run's own dates are the
			// only thing either verdict turns on.
			const early = springRule({ direction: null, season: { start: '01-01', end: '04-30' } });
			const verdict = evaluateThresholdRule(early, winterSpell, asOf);

			expect(citationOf(verdict)).toMatchObject({ from: '2026-01-28', to: '2026-01-30' });
		});

		it('fires a crossing on the first day of the season, reading the day before it from outside', () => {
			// Why the series is never pre-filtered to in-season days. The day that
			// proves the crossing is evidence for the run rather than part of it,
			// and fencing it out would leave the run looking like it opened the
			// series.
			const spring = springRule({ season: { start: '03-01', end: '05-31' } });
			const window = [
				day('2026-02-28', 52),
				day('2026-03-01', 55),
				day('2026-03-02', 57),
				day('2026-03-03', 58),
			];

			const verdict = evaluateThresholdRule(spring, window, '2026-03-03');

			expect(verdict).toMatchObject({ fires: true, status: 'fired' });
			expect(citationOf(verdict)).toMatchObject({ from: '2026-03-01', to: '2026-03-03' });
		});

		it('finds a run inside the season within a spell that began before it', () => {
			// A season needs this scan and a direction never does. The scan tests
			// every candidate the spell holds, so it finds the run from the 1st
			// through the 3rd even though the candidate the spell opens with starts
			// in January. A scan that stopped at that first candidate would answer
			// "no run".
			const fenced = springRule({ direction: null, season: { start: '02-01', end: '04-30' } });
			const window = [
				day('2026-01-30', 56),
				day('2026-01-31', 57),
				day('2026-02-01', 58),
				day('2026-02-02', 59),
				day('2026-02-03', 60),
			];

			const verdict = evaluateThresholdRule(fenced, window, '2026-02-03');

			expect(verdict).toMatchObject({ fires: true, status: 'fired' });
			expect(citationOf(verdict)).toMatchObject({ from: '2026-02-01', to: '2026-02-03' });
		});

		it('reads a season that wraps the year boundary', () => {
			// '11-15' through '02-15' has its end before its start, which
			// `isWithinMonthDayRange` reads as a wrap rather than as an error.
			// January is inside that range and March is not, so the same three
			// values answer two different ways.
			const overwinter = rule({ season: { start: '11-15', end: '02-15' } });
			const january = [day('2026-01-20', 68), day('2026-01-21', 67), day('2026-01-22', 66)];
			const march = [day('2026-03-20', 68), day('2026-03-21', 67), day('2026-03-22', 66)];

			expect(citationOf(evaluateThresholdRule(overwinter, january, '2026-01-22'))).toMatchObject({
				from: '2026-01-20',
				to: '2026-01-22',
			});
			expect(evaluateThresholdRule(overwinter, march, '2026-03-22')).toEqual({ fires: false });
		});

		it('does not project a run dated past the end of the season', () => {
			const window = [
				day('2026-02-25', 52),
				day('2026-02-26', 55),
				forecast('2026-02-27', 57),
				forecast('2026-02-28', 58),
			];
			const asOf = '2026-02-26';

			const fenced = springRule({ direction: null, season: { start: '02-01', end: '02-27' } });
			expect(evaluateThresholdRule(fenced, window, asOf)).toEqual({ fires: false });

			// A season one day longer holds the same forecast run. An Approaching
			// Task promises a day the Rule would fire on, so a run closing outside
			// the season is not one to promise.
			const wider = springRule({ direction: null, season: { start: '02-01', end: '02-28' } });
			expect(citationOf(evaluateThresholdRule(wider, window, asOf))).toMatchObject({ projectedDate: '2026-02-28' });
		});
	});
});
