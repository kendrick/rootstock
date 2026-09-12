import type { Location } from './location';
import type { Observation, Unit, Variable } from './observation';
import { z } from 'zod';
import { observationSchema } from './observation';

/**
 * Open-Meteo publishes under CC BY 4.0, and the licence requires attribution
 * wherever the data appears. Exported as one string so the interface renders
 * it from a single place and nobody re-derives the wording.
 */
export const OPEN_METEO_ATTRIBUTION = 'Weather data by Open-Meteo.com, licensed under CC BY 4.0.';

/**
 * Thrown for anything that makes a response unusable: a bad status, units
 * that do not match what was asked for, or a null. A named class so a caller
 * can tell a provider problem from a bug in the mapping.
 */
export class OpenMeteoError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'OpenMeteoError';
	}
}

const HISTORICAL_FORECAST_ENDPOINT = 'https://historical-forecast-api.open-meteo.com/v1/forecast';

/**
 * Both counts were measured against the live API and are load-bearing.
 *
 * 92 past days go to the historical-forecast endpoint rather than
 * `api.open-meteo.com/v1/forecast`, which keeps only about 57 past days of
 * `soil_temperature_6cm` and answers a 92-day request with 838 leading nulls
 * in soil and 641 in precipitation. Historical-forecast serves the full span
 * under the same forecast variable names, in one request.
 *
 * 7 forecast days is set by soil, which forecasts 7.33 days, against
 * precipitation and precipitation_probability, which both run a clean 16. The
 * shortest series sets the horizon because any null is a hard failure.
 *
 * Widening either number without re-measuring those retention windows puts
 * the nulls straight back.
 *
 * Seven days also contradicts ADR 0003, which describes the daily run as
 * pulling "a fortnight of forecast". A fortnight is unreachable rather than
 * merely unambitious, and AGENTS.md asks for saying so rather than quietly
 * shipping the smaller number. That ADR's decision, that the Artifact ships
 * the window the Rules evaluated, is untouched.
 */
const PAST_DAYS = 92;
const FORECAST_DAYS = 7;

interface Series {
	/** What Open-Meteo calls the series, in the `hourly=` parameter and in the response body. */
	apiName: string;
	variable: Variable;
	depthCm: number | null;
	unit: Unit;
	/** What `hourly_units` should say. The API answers in glyphs (`°F`, `%`), which are not `Unit` values. */
	reportedUnit: string;
}

/**
 * Where the API's names meet ours. The `hourly=` parameter is built from this
 * list, so what is requested and what is mapped cannot drift apart.
 *
 * A fourth series is two edits, not one: this array and `responseSchema`
 * below, which names the same keys so the parse can stay statically typed.
 * Forgetting the second is a compile error rather than a silent gap, because
 * indexing `payload.hourly` by an apiName the schema does not carry fails
 * typecheck.
 */
const SERIES = [
	{ apiName: 'soil_temperature_6cm', variable: 'soil-temperature', depthCm: 6, unit: 'F', reportedUnit: '°F' },
	{ apiName: 'precipitation', variable: 'precipitation', depthCm: null, unit: 'mm', reportedUnit: 'mm' },
	{ apiName: 'precipitation_probability', variable: 'precipitation-probability', depthCm: null, unit: 'percent', reportedUnit: '%' },
] as const satisfies readonly Series[];

const hourlySeriesSchema = z.array(z.number().nullable());

/**
 * Only the parts of the envelope this module reads. Deliberately not strict:
 * Open-Meteo also ships `elevation` and `generationtime_ms`, and rejecting an
 * unknown key would turn a harmless provider addition into a failed run.
 */
const responseSchema = z.object({
	hourly_units: z.record(z.string(), z.string()),
	hourly: z.object({
		time: z.array(z.number()),
		soil_temperature_6cm: hourlySeriesSchema,
		precipitation: hourlySeriesSchema,
		precipitation_probability: hourlySeriesSchema,
	}),
});

interface OpenMeteoHttpResponse {
	ok: boolean;
	status: number;
	json: () => Promise<unknown>;
}

/**
 * Narrower than the platform `fetch` on purpose: three members are all this
 * module touches, so a spec can hand in a plain object instead of casting a
 * half-built `Response` into shape. The real `globalThis.fetch` satisfies it.
 */
export type OpenMeteoFetch = (url: string) => Promise<OpenMeteoHttpResponse>;

export interface FetchObservationsOptions {
	location: Location;
	/**
	 * Required, with no default. The only sensible default is `new Date()`, and
	 * reading a clock is the defect CONTEXT.md's Planner entry names: it leaves
	 * the observed/forecast boundary impossible to test or reproduce.
	 */
	now: Date;
	fetch?: OpenMeteoFetch;
}

function buildUrl(location: Location): string {
	const url = new URL(HISTORICAL_FORECAST_ENDPOINT);
	url.searchParams.set('latitude', String(location.latitude));
	url.searchParams.set('longitude', String(location.longitude));
	url.searchParams.set('hourly', SERIES.map(series => series.apiName).join(','));
	url.searchParams.set('temperature_unit', 'fahrenheit');
	url.searchParams.set('timezone', location.timeZone);
	url.searchParams.set('timeformat', 'unixtime');
	url.searchParams.set('past_days', String(PAST_DAYS));
	url.searchParams.set('forecast_days', String(FORECAST_DAYS));
	return url.toString();
}

/**
 * Fetches one request's worth of hourly weather for a Location and maps every
 * value into an Observation.
 *
 * Both `now` and `fetch` arrive as arguments. `now` decides which hours are
 * `observed` and which are `forecast`, and a Threshold Rule may fire only on
 * observed hours, so the boundary has to be one a spec can name. Injecting
 * `fetch` lets that spec drive the mapping off a recorded response instead of
 * the network.
 *
 * A null anywhere in any requested series rejects the whole response.
 * Open-Meteo reports "nothing here" as a null under an HTTP 200, so a gap that
 * is skipped or zero-filled becomes a Plan that is confidently wrong about a
 * day nobody has data for. A run that fails is cheaper than that.
 *
 * Three traps in this API, all of which answer 200.
 *
 * The archive endpoint uses different variable names from the forecast
 * endpoints. Ask the archive for a forecast-endpoint variable and it returns
 * 200 with undefined units and a column of nulls instead of an error, so the
 * mistake shows up as missing data rather than a failed request.
 *
 * There is no usable daily soil aggregate. The forecast endpoint accepts the
 * daily mean soil variable and answers with a column of nulls. Daily means are
 * the Planner's work regardless—it reduces hourly Observations into
 * DailyAggregates and picks mean, min or sum per Rule—which is why this module
 * sends no `daily=` at all. ADR 0003 and CONTEXT.md's DailyAggregate entry both
 * draw that line in the same place.
 *
 * The 6cm value is modeled bare soil over a coarse grid cell, not a
 * measurement of irrigated turf. Every Observation here carries
 * `provenance: 'modeled'`, and that label has to survive all the way to the
 * screen: a watered lawn in a Texas July runs cooler than the model's bare dirt.
 *
 * The two day counts in the query are measured values with their own note at
 * `PAST_DAYS` and `FORECAST_DAYS` above, including why seven forecast days
 * rather than ADR 0003's fortnight.
 */
export async function fetchObservations({
	location,
	now,
	// Bound rather than passed by reference: an unbound `fetch` throws "Illegal
	// invocation" if this ever runs in a browser.
	fetch = globalThis.fetch.bind(globalThis),
}: FetchObservationsOptions): Promise<Observation[]> {
	const response = await fetch(buildUrl(location));
	if (!response.ok) {
		throw new OpenMeteoError(`Open-Meteo answered HTTP ${response.status}. No Observations were produced.`);
	}

	const payload = responseSchema.parse(await response.json());
	const { time } = payload.hourly;
	const records: unknown[] = [];

	for (const series of SERIES) {
		// The units are checked, never read off the response. A body arriving in °C
		// means the request did something other than what it says, and its numbers
		// would still look plausible for a Texas summer.
		const reportedUnit = payload.hourly_units[series.apiName];
		if (reportedUnit === undefined) {
			throw new OpenMeteoError(`Open-Meteo returned no units at all for ${series.apiName}. That is the archive endpoint answering for a variable it does not know under this name, and the column below it will be entirely null.`);
		}
		if (reportedUnit !== series.reportedUnit) {
			throw new OpenMeteoError(`Open-Meteo reported ${series.apiName} in '${reportedUnit}' when '${series.reportedUnit}' was requested. The query did not do what it says.`);
		}

		const values = payload.hourly[series.apiName];
		if (values.length !== time.length) {
			throw new OpenMeteoError(`Open-Meteo returned ${values.length} values for ${series.apiName} against ${time.length} timestamps. A misaligned series would date every Observation after the gap wrongly.`);
		}

		for (const [index, seconds] of time.entries()) {
			const observedAt = new Date(seconds * 1000).toISOString();
			const value = values[index] ?? null;
			if (value === null) {
				throw new OpenMeteoError(`Open-Meteo returned a null for ${series.apiName} at ${observedAt}. The whole response is rejected rather than returning the good prefix.`);
			}

			records.push({
				observedAt,
				variable: series.variable,
				depthCm: series.depthCm,
				value,
				unit: series.unit,
				// Strictly before `now`. An hour stamped exactly `now` has not
				// finished happening, and a Threshold Rule must not count it.
				basis: seconds * 1000 < now.getTime() ? 'observed' : 'forecast',
				provenance: 'modeled',
				source: 'open-meteo',
				station: null,
			});
		}
	}

	// One parse for the whole array. Zod puts the failing index in the issue
	// path either way, so parsing record by record sharpens no message and costs
	// one call per hour per series.
	return z.array(observationSchema).parse(records);
}
