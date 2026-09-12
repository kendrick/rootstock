import type { DailyAggregate } from './plan';
import type { GuardCondition } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { guardConditionSchema } from '@/rules/rule';
import { toDailyAggregates } from './aggregate';
import { asOf as fixtureAsOf, observations, rules, timeZone } from './fixtures';
import { evaluateGuardCondition } from './guard-conditions';
import { dailyAggregateSchema } from './plan';

/*
 * Every condition below is built through the real schema and every day through
 * the real one too, so a field that stops existing breaks this file where it
 * is authored rather than at whichever assertion happened to read it.
 *
 * The dates are written out in full rather than computed off `asOf`. Horizon
 * arithmetic is the thing under test, and a helper that shifted the dates
 * would be a second copy of `daysBetween` sitting inside its own spec.
 */
const asOf = '2026-09-11';
const yesterday = '2026-09-10';
const tomorrow = '2026-09-12';
const inTwoDays = '2026-09-13';
const inThreeDays = '2026-09-14';

const rainTemplate = {
	variable: 'precipitation-probability',
	depthCm: null,
	aggregate: 'max',
	unit: 'percent',
	basis: 'forecast',
	provenance: 'modeled',
	source: 'open-meteo',
};

function rainChance(date: string, value: number, fields: Partial<DailyAggregate> = {}): DailyAggregate {
	return dailyAggregateSchema.parse({ ...rainTemplate, date, value, ...fields });
}

function soilTemperature(date: string, value: number): DailyAggregate {
	return dailyAggregateSchema.parse({
		date,
		variable: 'soil-temperature',
		depthCm: 6,
		aggregate: 'mean',
		value,
		unit: 'F',
		basis: 'observed',
		provenance: 'modeled',
		source: 'open-meteo',
	});
}

const always: GuardCondition = guardConditionSchema.parse({ kind: 'always' });

function noRainWithin(days: number, probabilityAtLeast: number): GuardCondition {
	return guardConditionSchema.parse({ kind: 'no-rain-within', days, probabilityAtLeast });
}

function withinWindow(start: string, end: string, negate: boolean): GuardCondition {
	return guardConditionSchema.parse({ kind: 'within-window', start, end, negate });
}

/**
 * `rain-expected` out of the committed fixtures, narrowed by its own `kind`
 * discriminator, so re-authoring that fixture as another Rule kind fails here
 * by name instead of somewhere further down.
 */
function fixtureRainCondition(): GuardCondition {
	const found = rules.find(candidate => candidate.id === 'rain-expected');
	if (found === undefined || found.kind !== 'guard') {
		throw new Error('planner fixtures no longer hold the rain Guard this spec is built on');
	}
	return found.condition;
}

describe('evaluateGuardCondition', () => {
	describe('always', () => {
		it('is met with nothing in the window at all', () => {
			// A standing house rule reads no evidence, so the empty window that
			// strands `no-rain-within` on 'unavailable' has no bearing here.
			expect(evaluateGuardCondition(always, [], asOf)).toBe('met');
		});

		it('is met whatever the window carries', () => {
			const window = [rainChance(tomorrow, 0), soilTemperature(asOf, 68)];

			expect(evaluateGuardCondition(always, window, asOf)).toBe('met');
		});
	});

	describe('within-window', () => {
		/*
		 * Every case here passes an empty window on purpose. A calendar range
		 * reads no series, so the input that would strand `no-rain-within` on
		 * 'unavailable' has to leave these verdicts untouched.
		 */
		it('is met while the date sits inside the range', () => {
			expect(evaluateGuardCondition(withinWindow('09-01', '09-30', false), [], asOf)).toBe('met');
		});

		it('is unmet while the date sits outside the range', () => {
			expect(evaluateGuardCondition(withinWindow('03-01', '06-30', false), [], asOf)).toBe('unmet');
		});

		it('is unmet inside the range once negated', () => {
			expect(evaluateGuardCondition(withinWindow('09-01', '09-30', true), [], asOf)).toBe('unmet');
		});

		it('is met outside the range once negated', () => {
			// The shape `fig-fertilizer-until-spring` is authored in: hold the
			// fig's feeding on every date that is not March through June.
			expect(evaluateGuardCondition(withinWindow('03-01', '06-30', true), [], asOf)).toBe('met');
		});

		it('is met on the December side of a range that wraps the year', () => {
			expect(evaluateGuardCondition(withinWindow('12-01', '02-28', false), [], '2026-12-15')).toBe('met');
		});

		it('is met on the January side of a range that wraps the year', () => {
			// The case a naive start <= today && today <= end gets wrong every
			// year between January and the end of February.
			expect(evaluateGuardCondition(withinWindow('12-01', '02-28', false), [], '2027-01-15')).toBe('met');
		});

		it('is unmet in the gap a wrapping range leaves open', () => {
			expect(evaluateGuardCondition(withinWindow('12-01', '02-28', false), [], '2026-06-15')).toBe('unmet');
		});

		it('is unmet on both sides of New Year once a wrapping range is negated', () => {
			const condition = withinWindow('12-01', '02-28', true);

			expect(evaluateGuardCondition(condition, [], '2026-12-15')).toBe('unmet');
			expect(evaluateGuardCondition(condition, [], '2027-01-15')).toBe('unmet');
		});

		it('is met in the gap once a wrapping range is negated', () => {
			expect(evaluateGuardCondition(withinWindow('12-01', '02-28', true), [], '2026-06-15')).toBe('met');
		});
	});

	describe('no-rain-within', () => {
		it('is met when a forecast day inside the horizon clears the threshold', () => {
			const window = [rainChance(tomorrow, 10), rainChance(inTwoDays, 70)];

			expect(evaluateGuardCondition(noRainWithin(2, 50), window, asOf)).toBe('met');
		});

		it('is met by a day sitting exactly on the threshold', () => {
			// A Guard written at 50% holds the work on a day forecast at 50.
			// That is the off-by-one a reader is most likely to assume the
			// other way round.
			const window = [rainChance(tomorrow, 50)];

			expect(evaluateGuardCondition(noRainWithin(2, 50), window, asOf)).toBe('met');
		});

		it('is met by a day on the last date of the horizon', () => {
			const window = [rainChance(inTwoDays, 90)];

			expect(evaluateGuardCondition(noRainWithin(2, 50), window, asOf)).toBe('met');
		});

		it('is unmet when every day inside the horizon stays under the threshold', () => {
			const window = [rainChance(tomorrow, 10), rainChance(inTwoDays, 20)];

			expect(evaluateGuardCondition(noRainWithin(2, 50), window, asOf)).toBe('unmet');
		});

		it('ignores a storm one day past the horizon', () => {
			// This case and the last-date case above fix both ends of the
			// horizon between them: a day exactly `days` out is read, and the
			// next one is not.
			const window = [rainChance(tomorrow, 10), rainChance(inThreeDays, 90)];

			expect(evaluateGuardCondition(noRainWithin(2, 50), window, asOf)).toBe('unmet');
		});

		it('is unavailable on an empty window', () => {
			// This is the live trap: `buildWindow` collects series from
			// Threshold Rules alone, so an empty window is what a rain Guard is
			// handed today. An 'unmet' here would let the watering go ahead on the
			// strength of a series nobody ever fetched.
			expect(evaluateGuardCondition(noRainWithin(2, 50), [], asOf)).toBe('unavailable');
		});

		it('is unavailable when the window carries no precipitation probability at all', () => {
			const window = [soilTemperature(yesterday, 69), soilTemperature(asOf, 68)];

			expect(evaluateGuardCondition(noRainWithin(2, 50), window, asOf)).toBe('unavailable');
		});

		it('is unavailable when the forecast stops short of the horizon', () => {
			const window = [rainChance(inThreeDays, 10)];

			expect(evaluateGuardCondition(noRainWithin(2, 50), window, asOf)).toBe('unavailable');
		});

		it('is unavailable when the horizon holds only a stale forecast', () => {
			// Dated before the planned date, so it is left over from an
			// earlier fetch and says nothing about the days ahead.
			const window = [rainChance(yesterday, 90)];

			expect(evaluateGuardCondition(noRainWithin(2, 50), window, asOf)).toBe('unavailable');
		});

		it('is unavailable when the rows on hand are observed rather than forecast', () => {
			const window = [rainChance(tomorrow, 10, { basis: 'observed' })];

			expect(evaluateGuardCondition(noRainWithin(2, 50), window, asOf)).toBe('unavailable');
		});

		it('is unavailable when the rows on hand are means rather than maxima', () => {
			// 15 as a daily mean is not 15 as a daily maximum, and reading one
			// for the other would understate the afternoon it was averaged out
			// of. There is no daily maximum here, so there is nothing to read.
			const window = [rainChance(tomorrow, 15, { aggregate: 'mean' })];

			expect(evaluateGuardCondition(noRainWithin(2, 50), window, asOf)).toBe('unavailable');
		});

		it('is met against the committed fixture forecast', () => {
			/*
			 * The fixture paints a front onto the day two out from `asOf`, at
			 * a 70% afternoon chance, which is the day the two-day horizon
			 * just reaches. Reducing the real Observations with 'max' is what
			 * the Guard reads, so this proves the fixture's own forecast shape
			 * clears `rain-expected` rather than only a hand-built window
			 * doing so.
			 */
			const window = toDailyAggregates(observations, timeZone, 'max');

			expect(evaluateGuardCondition(fixtureRainCondition(), window, fixtureAsOf)).toBe('met');
		});
	});
});
