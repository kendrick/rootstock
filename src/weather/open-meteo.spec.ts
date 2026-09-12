import type { Observation } from './observation';
import type { OpenMeteoFetch } from './open-meteo';
import { describe, expect, it } from 'vitest';
import fortWorth from './fixtures/open-meteo-fort-worth.json';
import nullSoil from './fixtures/open-meteo-null-soil.json';
import { observationSchema } from './observation';
import { fetchObservations, OPEN_METEO_ATTRIBUTION, OpenMeteoError } from './open-meteo';

/**
 * The Fort Worth Botanic Garden, a public landmark and deliberately not the
 * property. ADR 0004 keeps real coordinates out of every committed file, and a
 * fixture is a committed file.
 */
const LOCATION = {
	latitude: 32.733276,
	longitude: -97.346596,
	timeZone: 'America/Chicago',
};

/**
 * Hour 1000 of the recorded fixture, so both sides of the split are large and
 * the boundary hour is one the assertions can name.
 */
const NOW = new Date('2026-07-23T21:00:00.000Z');

const HOURS_IN_FIXTURE = 2376;
const HOURS_BEFORE_NOW = 1000;

/**
 * A double that answers with one recorded body and keeps the URLs it was
 * handed. Injected as an argument rather than installed with `vi.mock`: the
 * seam is part of the function's signature, so the test exercises the real
 * module instead of a rewritten copy of it.
 */
function recordingFetch(body: unknown, status = 200): { fetch: OpenMeteoFetch; calls: string[] } {
	const calls: string[] = [];
	const fetch: OpenMeteoFetch = (url) => {
		calls.push(url);
		return Promise.resolve({
			ok: status >= 200 && status < 300,
			status,
			json: () => Promise.resolve(body),
		});
	};
	return { fetch, calls };
}

function fetchFortWorth(): Promise<Observation[]> {
	const { fetch } = recordingFetch(fortWorth);
	return fetchObservations({ location: LOCATION, now: NOW, fetch });
}

describe('the query fetchObservations builds', () => {
	it('asks the historical-forecast endpoint for exactly the settled parameters', async () => {
		const { fetch, calls } = recordingFetch(fortWorth);
		await fetchObservations({ location: LOCATION, now: NOW, fetch });

		expect(calls).toHaveLength(1);
		const [requested = ''] = calls;
		const url = new URL(requested);

		// Not api.open-meteo.com: that host keeps about 57 past days of
		// soil_temperature_6cm and answers past_days=92 with a wall of nulls.
		expect(url.origin).toBe('https://historical-forecast-api.open-meteo.com');
		expect(url.pathname).toBe('/v1/forecast');

		// Whole-map equality rather than parameter-by-parameter, so a stray extra
		// parameter fails here instead of reaching the API.
		expect(Object.fromEntries(url.searchParams)).toEqual({
			latitude: '32.733276',
			longitude: '-97.346596',
			hourly: 'soil_temperature_6cm,precipitation,precipitation_probability',
			temperature_unit: 'fahrenheit',
			timezone: 'America/Chicago',
			timeformat: 'unixtime',
			past_days: '92',
			forecast_days: '7',
		});
	});

	it('never asks for a daily aggregate', async () => {
		const { fetch, calls } = recordingFetch(fortWorth);
		await fetchObservations({ location: LOCATION, now: NOW, fetch });

		// Daily reduction belongs to the Planner (ADR 0003), and the daily soil
		// variable on this API returns a column of nulls anyway.
		const [requested = ''] = calls;
		expect(new URL(requested).searchParams.has('daily')).toBe(false);
	});
});

describe('the Observations fetchObservations returns', () => {
	it('emits one record per hour per series', async () => {
		expect(await fetchFortWorth()).toHaveLength(3 * HOURS_IN_FIXTURE);
	});

	it('returns records that all parse through observationSchema', async () => {
		// The module already parses before it returns, so this guards against that
		// parse being loosened later.
		const parsed = observationSchema.array().safeParse(await fetchFortWorth());
		expect(parsed.error).toBeUndefined();
	});

	it('maps the API snake_case series onto the schema kebab-case enum', async () => {
		const observations = await fetchFortWorth();

		expect(new Set(observations.map(observation => observation.variable))).toEqual(
			new Set(['soil-temperature', 'precipitation', 'precipitation-probability']),
		);
	});

	it('gives soil its depth and the schema unit, not the glyph the API reports', async () => {
		const soil = (await fetchFortWorth()).filter(observation => observation.variable === 'soil-temperature');
		const [first] = soil;

		expect(first).toEqual({
			observedAt: '2026-06-12T05:00:00.000Z',
			variable: 'soil-temperature',
			depthCm: 6,
			value: 83.2,
			unit: 'F',
			basis: 'observed',
			provenance: 'modeled',
			source: 'open-meteo',
			station: null,
		});
		expect(soil.every(observation => observation.depthCm === 6 && observation.unit === 'F')).toBe(true);
	});

	it('leaves both precipitation series without a depth and in their own units', async () => {
		const observations = await fetchFortWorth();
		const rain = observations.filter(observation => observation.variable === 'precipitation');
		const chance = observations.filter(observation => observation.variable === 'precipitation-probability');

		expect(rain.every(observation => observation.depthCm === null && observation.unit === 'mm')).toBe(true);
		expect(chance.every(observation => observation.depthCm === null && observation.unit === 'percent')).toBe(true);
	});

	it('labels every reading modeled and sourced to open-meteo with no station', async () => {
		const observations = await fetchFortWorth();

		// Issue #9: the 6cm value is modeled bare soil for a coarse grid cell, so
		// nothing from this provider may ever pass as a measurement.
		expect(observations.every(observation => observation.provenance === 'modeled')).toBe(true);
		expect(observations.every(observation => observation.source === 'open-meteo')).toBe(true);
		expect(observations.every(observation => observation.station === null)).toBe(true);
	});
});

describe('the observed/forecast split', () => {
	it('splits the fixture on the injected now rather than a clock', async () => {
		const soil = (await fetchFortWorth()).filter(observation => observation.variable === 'soil-temperature');

		expect(soil.filter(observation => observation.basis === 'observed')).toHaveLength(HOURS_BEFORE_NOW);
		expect(soil.filter(observation => observation.basis === 'forecast')).toHaveLength(HOURS_IN_FIXTURE - HOURS_BEFORE_NOW);
	});

	it('counts the hour stamped exactly now as forecast', async () => {
		const soil = (await fetchFortWorth()).filter(observation => observation.variable === 'soil-temperature');

		// The boundary is strict: the hour `now` sits inside has not finished
		// happening, and a Threshold Rule that counted it would fire on a partial
		// reading it can never un-fire on.
		expect(soil[HOURS_BEFORE_NOW - 1]?.observedAt).toBe('2026-07-23T20:00:00.000Z');
		expect(soil[HOURS_BEFORE_NOW - 1]?.basis).toBe('observed');
		expect(soil[HOURS_BEFORE_NOW]?.observedAt).toBe('2026-07-23T21:00:00.000Z');
		expect(soil[HOURS_BEFORE_NOW]?.basis).toBe('forecast');
	});
});

describe('rejections', () => {
	it('rejects the whole response when any series carries a null', async () => {
		const { fetch } = recordingFetch(nullSoil);

		// The null fixture has six missing soil hours in the middle of forty-eight
		// otherwise complete ones, and none of the forty-two good hours come back.
		await expect(fetchObservations({ location: LOCATION, now: NOW, fetch })).rejects.toBeInstanceOf(OpenMeteoError);
	});

	it('names the offending series and the first missing hour', async () => {
		const { fetch } = recordingFetch(nullSoil);

		await expect(fetchObservations({ location: LOCATION, now: NOW, fetch })).rejects.toThrow(/soil_temperature_6cm/);
		await expect(fetchObservations({ location: LOCATION, now: NOW, fetch })).rejects.toThrow('2026-06-12T17:00:00.000Z');
	});

	it('rejects a response whose units are not the ones requested', async () => {
		// A °C body parses and produces plausible-looking Texas numbers, so the
		// reported units are the only thing that catches a query that changed
		// without saying so.
		const celsius = { ...fortWorth, hourly_units: { ...fortWorth.hourly_units, soil_temperature_6cm: '°C' } };
		const { fetch } = recordingFetch(celsius);

		await expect(fetchObservations({ location: LOCATION, now: NOW, fetch })).rejects.toThrow(/soil_temperature_6cm/);
	});

	it('rejects a non-success status rather than parsing the body', async () => {
		const { fetch } = recordingFetch({}, 429);

		await expect(fetchObservations({ location: LOCATION, now: NOW, fetch })).rejects.toBeInstanceOf(OpenMeteoError);
	});
});

describe('the exported attribution', () => {
	it('carries the attribution the CC BY 4.0 licence requires', () => {
		expect(OPEN_METEO_ATTRIBUTION).toContain('Open-Meteo');
		expect(OPEN_METEO_ATTRIBUTION).toContain('CC BY 4.0');
	});
});
