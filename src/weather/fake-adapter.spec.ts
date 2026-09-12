import type { Observation } from './observation';
import { describe, expect, it } from 'vitest';
import { fakeObservations } from './fake-adapter';

// Two arbitrary places, far apart. The fake must answer identically for both,
// which is the property these constants exist to make visible.
const ANYWHERE = { latitude: 30.27, longitude: -97.74, timeZone: 'America/Chicago' };
const ELSEWHERE = { latitude: 51.5, longitude: -0.12, timeZone: 'Europe/London' };

// Hand-built rather than imported: the JSON fixtures belong to the real
// adapter's spec, and pulling them in here would make this spec depend on a
// mapping this module has no part in.
const observations: Observation[] = [
	{
		observedAt: '2026-09-10T06:00:00.000Z',
		variable: 'soil-temperature',
		depthCm: 6,
		value: 71.4,
		unit: 'F',
		basis: 'observed',
		provenance: 'modeled',
		source: 'open-meteo',
		station: null,
	},
	{
		observedAt: '2026-09-10T07:00:00.000Z',
		variable: 'precipitation',
		depthCm: null,
		value: 0.2,
		unit: 'mm',
		basis: 'forecast',
		provenance: 'modeled',
		source: 'open-meteo',
		station: null,
	},
];

describe('fakeObservations', () => {
	it('resolves to exactly the list handed in, same contents and order', async () => {
		const fetch = fakeObservations(observations);

		await expect(fetch({ location: ANYWHERE, now: new Date('2026-09-10T12:00:00.000Z') })).resolves.toEqual(observations);
	});

	it('ignores its arguments: different location/now yield the same list', async () => {
		const fetch = fakeObservations(observations);

		const first = await fetch({ location: ANYWHERE, now: new Date('2020-01-01T00:00:00.000Z') });
		const second = await fetch({ location: ELSEWHERE, now: new Date('2030-06-15T00:00:00.000Z') });

		expect(first).toEqual(second);
		expect(first).toEqual(observations);
	});

	it('round-trips an empty list as an empty list', async () => {
		const fetch = fakeObservations([]);

		await expect(fetch({ location: ANYWHERE, now: new Date('2026-09-10T00:00:00.000Z') })).resolves.toEqual([]);
	});
});
