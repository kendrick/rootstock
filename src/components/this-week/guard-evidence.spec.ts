import type { DailyAggregate } from '@/planner/plan';
import type { Rule } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { seedRules } from '@/seed';
import { guardEvidence, rainBefore } from './guard-evidence';

function rain(date: string, value: number, overrides: Partial<DailyAggregate> = {}): DailyAggregate {
	return { date, variable: 'precipitation-probability', depthCm: null, aggregate: 'max', value, unit: 'percent', basis: 'forecast', provenance: 'modeled', source: 'open-meteo', ...overrides };
}

const rainExpected = seedRules.find(rule => rule.id === 'rain-expected');
const waterIn = seedRules.find(rule => rule.id === 'water-in-after-application');

describe('guardEvidence', () => {
	it('prints the rain chance for each day the Guard reads, and no other', () => {
		// The seed Guard reads today and the two days after it. The row before the
		// planned date is a leftover forecast, and the fourth day is past its reach.
		const window = [rain('2026-09-27', 36), rain('2026-09-28', 8), rain('2026-09-29', 2.4), rain('2026-09-30', 78), rain('2026-10-01', 81)];

		expect(guardEvidence(rainExpected, window, '2026-09-28')).toBe('Rain chance Sep 28 8% / Sep 29 2% / Sep 30 78%');
	});

	it('reads only the daily maximum from the forecast, the rows the verdict reads', () => {
		const window = [rain('2026-09-28', 90, { aggregate: 'mean' }), rain('2026-09-28', 40), rain('2026-09-29', 70, { basis: 'observed' })];

		expect(guardEvidence(rainExpected, window, '2026-09-28')).toBe('Rain chance Sep 28 40%');
	});

	it('says nothing for a Guard that reads no series', () => {
		expect(guardEvidence(waterIn, [rain('2026-09-28', 8)], '2026-09-28')).toBeNull();
	});

	it('says nothing when the window holds none of the Guard\'s days', () => {
		expect(guardEvidence(rainExpected, [rain('2026-09-20', 8)], '2026-09-28')).toBeNull();
	});
});

describe('guardEvidence, forecast-reaches', () => {
	function airHigh(date: string, value: number, overrides: Partial<DailyAggregate> = {}): DailyAggregate {
		return { date, variable: 'air-temperature', depthCm: null, aggregate: 'max', value, unit: 'F', basis: 'forecast', provenance: 'modeled', source: 'open-meteo', ...overrides };
	}

	const heatLimit = {
		...waterIn!,
		id: 'heat-limit',
		condition: { kind: 'forecast-reaches', variable: 'air-temperature', depthCm: null, aggregate: 'max', comparison: 'gte', value: 90, unit: 'F', consecutiveDays: 2 },
	} as Rule;

	it('prints the forecast reading for each day the Guard reads, and no other', () => {
		const window = [airHigh('2026-05-19', 99), airHigh('2026-05-20', 94.6), airHigh('2026-05-21', 91.24), airHigh('2026-05-22', 97)];

		expect(guardEvidence(heatLimit, window, '2026-05-20')).toBe('Forecast maximum air temperature May 20 94.6°F / May 21 91.2°F');
	});

	// #59: a day forecast at 89.96 didn't reach 90, so it can't print as 90.
	it('keeps a reading on its side of the Guard\'s value', () => {
		expect(guardEvidence(heatLimit, [airHigh('2026-05-20', 89.96)], '2026-05-20')).toBe('Forecast maximum air temperature May 20 89.96°F');
	});
});

describe('rainBefore', () => {
	const window = [rain('2026-09-28', 8), rain('2026-09-29', 2), rain('2026-09-30', 78)];

	it('names the first day at or past the Guard\'s line, up to the close', () => {
		expect(rainBefore(rainExpected, window, '2026-09-28', '2026-09-30')).toEqual({ date: '2026-09-30', chance: 78 });
	});

	it('finds nothing when the wet day falls after the close', () => {
		expect(rainBefore(rainExpected, window, '2026-09-28', '2026-09-29')).toBeNull();
	});

	it('finds nothing for a Guard that reads no rain', () => {
		expect(rainBefore(waterIn, window, '2026-09-28', '2026-09-30')).toBeNull();
	});
});
