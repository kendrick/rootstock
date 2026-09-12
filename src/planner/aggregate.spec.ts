import type { DailyAggregate } from './plan';
import type { Observation } from '@/weather/observation';
import { describe, expect, it } from 'vitest';
import { toDailyAggregates } from './aggregate';
import { observations as fixtureObservations, timeZone as fixtureTimeZone } from './fixtures';
import { dailyAggregateSchema } from './plan';

/**
 * `noUncheckedIndexedAccess` types every `records[0]` as possibly
 * `undefined`, which is correct for an arbitrary array but noise for a test
 * that has already asserted there is exactly one record. This asserts that
 * length once and hands back a record TypeScript will treat as definite.
 */
function single(records: DailyAggregate[]): DailyAggregate {
	expect(records).toHaveLength(1);
	const [record] = records;
	if (record === undefined) {
		throw new Error('unreachable: length was just asserted to be 1');
	}
	return record;
}

const timeZone = 'UTC';

/*
 * A template rather than a factory with optional parameters, so every test
 * spreads only the fields it actually varies and the rest read as constants
 * rather than as a wall of unrelated arguments. 'UTC' as the fixture zone
 * keeps an hour's instant and its local day the same string, which is what
 * lets each test's intent live in `value`, `basis`, and `provenance` instead
 * of in zone arithmetic that `dates.spec.ts` already covers.
 */
const base: Observation = {
	observedAt: '2026-09-11T12:00:00Z',
	variable: 'soil-temperature',
	depthCm: 6,
	value: 70,
	unit: 'F',
	basis: 'observed',
	provenance: 'modeled',
	source: 'open-meteo',
	station: null,
};

function at(hour: number, fields: Partial<Observation> = {}): Observation {
	const paddedHour = String(hour).padStart(2, '0');
	return { ...base, observedAt: `2026-09-11T${paddedHour}:00:00Z`, ...fields };
}

describe('toDailyAggregates', () => {
	it('reduces a full day of hourly values to their mean', () => {
		const result = toDailyAggregates(
			[at(0, { value: 60 }), at(6, { value: 62 }), at(12, { value: 64 }), at(18, { value: 66 })],
			timeZone,
			'mean',
		);

		expect(single(result).value).toBe(63);
	});

	it('reduces the same day to min, max, and sum on request', () => {
		const day = [at(0, { value: 10 }), at(8, { value: 20 }), at(16, { value: 30 })];

		expect(single(toDailyAggregates(day, timeZone, 'min')).value).toBe(10);
		expect(single(toDailyAggregates(day, timeZone, 'max')).value).toBe(30);
		expect(single(toDailyAggregates(day, timeZone, 'sum')).value).toBe(60);
	});

	it('keeps two depths of the same variable in separate groups', () => {
		const result = toDailyAggregates(
			[at(0, { depthCm: 6, value: 70 }), at(0, { depthCm: 12, value: 64 })],
			timeZone,
			'mean',
		);

		expect(result).toHaveLength(2);
		const shallow = result.find(record => record.depthCm === 6);
		const deep = result.find(record => record.depthCm === 12);
		expect(shallow?.value).toBe(70);
		expect(deep?.value).toBe(64);
	});

	it('marks a day forecast when even one of its hours is forecast', () => {
		const result = toDailyAggregates(
			[at(0, { basis: 'observed' }), at(12, { basis: 'forecast' }), at(18, { basis: 'observed' })],
			timeZone,
			'mean',
		);

		expect(single(result).basis).toBe('forecast');
	});

	it('leaves a day observed when none of its hours are forecast', () => {
		const result = toDailyAggregates([at(0), at(12), at(18)], timeZone, 'mean');

		expect(single(result).basis).toBe('observed');
	});

	it('lets a single measured reading displace every modeled one for that day', () => {
		const result = toDailyAggregates(
			[
				at(0, { provenance: 'modeled', source: 'open-meteo', value: 68 }),
				at(8, { provenance: 'measured', source: 'manual', station: 'backyard-probe', value: 71 }),
				at(16, { provenance: 'modeled', source: 'open-meteo', value: 69 }),
			],
			timeZone,
			'mean',
		);

		const record = single(result);
		expect(record.provenance).toBe('measured');
		expect(record.source).toBe('manual');
		// The modeled 68 and 69 must be excluded, not averaged in with the probe.
		expect(record.value).toBe(71);
	});

	it('reports modeled provenance when a day carries no measured reading', () => {
		const result = toDailyAggregates(
			[at(0, { value: 68 }), at(12, { value: 70 })],
			timeZone,
			'mean',
		);

		const record = single(result);
		expect(record.provenance).toBe('modeled');
		expect(record.source).toBe('open-meteo');
	});

	it('returns groups in a stable order: date, then variable, then depth with null last', () => {
		const observations: Observation[] = [
			{ ...base, observedAt: '2026-09-12T00:00:00Z', variable: 'soil-temperature', depthCm: 12, value: 1 },
			{ ...base, observedAt: '2026-09-11T00:00:00Z', variable: 'soil-temperature', depthCm: 6, value: 2 },
			{
				...base,
				observedAt: '2026-09-11T00:00:00Z',
				variable: 'precipitation',
				depthCm: null,
				value: 3,
				unit: 'mm',
			},
			{ ...base, observedAt: '2026-09-11T00:00:00Z', variable: 'soil-temperature', depthCm: null, value: 4 },
		];

		const result = toDailyAggregates(observations, timeZone, 'mean');

		expect(result.map(record => [record.date, record.variable, record.depthCm])).toEqual([
			['2026-09-11', 'precipitation', null],
			['2026-09-11', 'soil-temperature', 6],
			['2026-09-11', 'soil-temperature', null],
			['2026-09-12', 'soil-temperature', 12],
		]);
	});

	it('returns records that all parse through dailyAggregateSchema', () => {
		const result = toDailyAggregates(fixtureObservations, fixtureTimeZone, 'mean');

		expect(result.length).toBeGreaterThan(0);
		for (const record of result) {
			expect(() => dailyAggregateSchema.parse(record)).not.toThrow();
		}
	});
});
