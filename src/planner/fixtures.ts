import type { Occurrence } from './occurrence';
import type { Rule, TagPolicy } from '@/rules/rule';
import type { Observation } from '@/weather/observation';
import type { Plant } from '@/yard/plant';
import { z } from 'zod';
import { ruleSchema, tagPolicySchema } from '@/rules/rule';
import { parseWith } from '@/validation/parse';
import { observationSchema } from '@/weather/observation';
import { plantSchema } from '@/yard/plant';
import { occurrenceSchema } from './occurrence';
import { PLAN_WINDOW_DAYS } from './plan';

/*
 * One September morning in the real yard, shaped for the specs that exercise
 * the Planner. Every value below is run through the schema the real inputs go
 * through, so a schema change breaks this file where it is authored rather
 * than at whichever assertion happened to touch the changed key.
 *
 * The set is deliberately awkward: a Plant nobody has planted yet, a Window
 * Rule whose range crosses New Year, a Cadence Rule with Occurrences behind it
 * beside one with none, and a day carrying a probe value next to the modeled
 * ones. The Planner has to get all four right, and a tidy fixture lets every
 * one of them regress unnoticed.
 */

/** The date planned for. Shared with `src/artifact/fixtures.ts` so the two sets describe the same morning. */
export const asOf = '2026-09-11';

/**
 * Observations carry UTC instants, so the Planner cannot bucket them into
 * calendar days without being told whose calendar. North Texas is the yard,
 * and the zone is an input because it belongs to the property rather than to
 * the code.
 */
export const timeZone = 'America/Chicago';

const region = { name: 'Fort Worth', hardinessZone: '8b' };

const extensionSource = {
	kind: 'extension',
	label: 'Texas A&M AgriLife Extension',
	url: 'https://agrilifeextension.tamu.edu/',
};

const ownerSource = { kind: 'owner', label: 'House practice', url: null };

const preEmergentLabel = { url: 'https://example.com/labels/prodiamine-65-wdg.pdf' };

/**
 * `pomegranate-1` is here to be ignored. It is tagged `fruit`, so the mulch
 * Rule below selects it on tags alone, and it is only planned, so the Planner
 * owes it no work at all. A fixture holding nothing but planted things would
 * let the Planner start authoring work for a plant that is not in the ground
 * yet, and nothing would say so.
 */
export const plants: Plant[] = parseWith(z.array(plantSchema), 'planner fixtures: plants')([
	{
		id: 'front-lawn',
		name: 'Front lawn',
		kind: 'lawn',
		status: 'planted',
		tags: ['lawn'],
		position: { x: 0.42, y: 0.61 },
		site: 'Front, full sun',
		lawn: {
			grass: 'Bermuda',
			areaSqFt: 3200,
			soil: 'clay loam',
			irrigation: { schedule: 'Tuesdays and Saturdays before dawn', source: 'asserted' },
		},
		notes: null,
	},
	{
		id: 'fig-1',
		name: 'Celeste fig',
		kind: 'plant',
		status: 'planted',
		tags: ['fruit', 'fig'],
		position: { x: 0.71, y: 0.34 },
		site: 'West fence',
		lawn: null,
		notes: null,
	},
	{
		id: 'esperanza-1',
		name: 'Esperanza',
		kind: 'container',
		status: 'planted',
		tags: ['flowering', 'container'],
		position: null,
		site: 'Back patio',
		lawn: null,
		notes: null,
	},
	{
		id: 'pomegranate-1',
		name: 'Wonderful pomegranate',
		kind: 'plant',
		status: 'planned',
		tags: ['fruit'],
		position: null,
		site: null,
		lawn: null,
		notes: 'Bare root, going in over winter.',
	},
]);

/**
 * Five Rules that create work and two Guards that do not, chosen to cover the
 * shapes the Planner branches on rather than to describe a complete yard.
 *
 * `winter-mulch-refresh` runs December into February, so its range ends before
 * it starts. That wrap is the case a naive `start <= today && today <= end`
 * gets wrong every year between January and March, and it belongs in the
 * fixture rather than in a comment about it.
 *
 * The three `appliesTo` shapes all appear: named plants on the pre-emergent
 * Rules, tags alone on the mulch, and nothing at all on `rain-expected`, which
 * is how a Rule says "the whole yard".
 */
export const rules: Rule[] = parseWith(z.array(ruleSchema), 'planner fixtures: rules')([
	{
		id: 'fall-pre-emergent',
		name: 'Fall pre-emergent on the front lawn',
		kind: 'window',
		region,
		source: extensionSource,
		tags: ['lawn', 'pre-emergent', 'chemical'],
		delegable: false,
		priority: 10,
		appliesTo: { plantIds: ['front-lawn'], plantTags: null, ruleTags: null },
		productLabel: preEmergentLabel,
		start: '09-01',
		end: '09-30',
	},
	{
		id: 'winter-mulch-refresh',
		name: 'Refresh mulch around the fruit trees',
		kind: 'window',
		region,
		source: ownerSource,
		tags: ['mulch'],
		delegable: true,
		priority: 40,
		appliesTo: { plantIds: null, plantTags: ['fruit'], ruleTags: null },
		productLabel: null,
		start: '12-01',
		end: '02-28',
	},
	{
		id: 'fall-pre-emergent-soil',
		name: 'Fall pre-emergent once soil temperature settles at 70F',
		kind: 'threshold',
		region,
		source: extensionSource,
		tags: ['lawn', 'pre-emergent', 'chemical'],
		delegable: false,
		priority: 11,
		appliesTo: { plantIds: ['front-lawn'], plantTags: null, ruleTags: null },
		productLabel: preEmergentLabel,
		variable: 'soil-temperature',
		depthCm: 6,
		aggregate: 'mean',
		comparison: 'lte',
		value: 70,
		unit: 'F',
		consecutiveDays: 3,
		published: { low: 65, high: 70, source: extensionSource },
	},
	{
		id: 'esperanza-feeding',
		name: 'Feed the esperanza',
		kind: 'cadence',
		region,
		source: ownerSource,
		tags: ['feeding', 'chemical'],
		delegable: false,
		priority: 30,
		appliesTo: { plantIds: ['esperanza-1'], plantTags: null, ruleTags: null },
		productLabel: { url: 'https://example.com/labels/bloom-booster.pdf' },
		everyDays: { min: 28, max: 42 },
		season: { start: '03-15', end: '10-05' },
		after: null,
	},
	{
		id: 'fall-pre-emergent-split',
		name: 'Second half of the split fall pre-emergent',
		kind: 'cadence',
		region,
		source: extensionSource,
		tags: ['lawn', 'pre-emergent', 'chemical'],
		delegable: false,
		priority: 12,
		appliesTo: { plantIds: ['front-lawn'], plantTags: null, ruleTags: null },
		productLabel: preEmergentLabel,
		everyDays: { min: 42, max: 56 },
		season: { start: '09-01', end: '12-31' },
		after: { ruleId: 'fall-pre-emergent' },
	},
	{
		id: 'rain-expected',
		name: 'Hold watering when rain is coming',
		kind: 'guard',
		region,
		source: ownerSource,
		tags: ['watering'],
		delegable: false,
		priority: 90,
		appliesTo: { plantIds: null, plantTags: null, ruleTags: null },
		productLabel: null,
		condition: { kind: 'no-rain-within', days: 2, probabilityAtLeast: 50 },
		effect: 'defer',
		release: 'No day above a 50% chance of rain in the next two days',
	},
	{
		id: 'water-in-after-application',
		name: 'Water in a pre-emergent application',
		kind: 'guard',
		region,
		source: extensionSource,
		tags: ['lawn'],
		delegable: false,
		priority: 91,
		appliesTo: { plantIds: null, plantTags: null, ruleTags: ['pre-emergent'] },
		productLabel: null,
		condition: { kind: 'always' },
		effect: 'annotate',
		text: 'Water in with a quarter inch within 48 hours.',
	},
]);

/**
 * Two feedings behind `esperanza-feeding` and nothing at all behind
 * `fall-pre-emergent-split`. The pair is the point: a Cadence Rule counts from
 * the most recent matching Occurrence, and one with none still fires, so a
 * fixture that fed every Rule would test only half the branch.
 *
 * The August record was written three days after the work, which is what a
 * backfill looks like and why `completedAt` and `recordedAt` are separate.
 */
export const occurrences: Occurrence[] = parseWith(z.array(occurrenceSchema), 'planner fixtures: occurrences')([
	{
		id: 'esperanza-feeding-2026-06-28',
		ruleId: 'esperanza-feeding',
		plantId: 'esperanza-1',
		completedAt: '2026-06-28T13:10:00Z',
		recordedAt: '2026-06-28T13:12:00Z',
		source: 'seed',
	},
	{
		id: 'esperanza-feeding-2026-08-02',
		ruleId: 'esperanza-feeding',
		plantId: 'esperanza-1',
		completedAt: '2026-08-02T14:20:00Z',
		recordedAt: '2026-08-05T02:41:00Z',
		source: 'browser',
	},
]);

/** How many forecast days run past the as-of date, enough for the two-day lookahead `rain-expected` asks for. */
const FORECAST_DAYS = 3;

/**
 * Central Daylight Time, written as a fixed offset because every day in this
 * fixture sits inside it; the changeover is in November. Turning a local hour
 * into a UTC instant properly is the Planner's job and needs the zone, not an
 * offset; this file only has to produce instants that land where they should.
 */
const CENTRAL_DAYLIGHT_OFFSET_HOURS = 5;

function shiftDate(date: string, days: number): string {
	const shifted = new Date(`${date}T00:00:00Z`);
	shifted.setUTCDate(shifted.getUTCDate() + days);
	return shifted.toISOString().slice(0, 10);
}

function utcInstant(localDate: string, localHour: number): string {
	const instant = new Date(`${localDate}T00:00:00Z`);
	instant.setUTCHours(localHour + CENTRAL_DAYLIGHT_OFFSET_HOURS);
	return `${instant.toISOString().slice(0, 19)}Z`;
}

function round(value: number): number {
	return Number(value.toFixed(1));
}

/*
 * A warm plateau in the high seventies, then a front eight days out that drops
 * soil temperature about a degree and a third a day. The shape is chosen so
 * that exactly the last three days sit at or below 70F: that is the run
 * `fall-pre-emergent-soil` asks for, which makes the fixture fire the Rule on
 * the as-of date and not a day earlier. Widen the fall and the Rule fires
 * early enough that an off-by-one in the run counter passes anyway.
 */
function soilTemperatureMean(daysBeforeAsOf: number): number {
	if (daysBeforeAsOf >= 8) {
		return round(78 - daysBeforeAsOf * 0.1);
	}
	return round(77.2 - (8 - daysBeforeAsOf) * 1.3);
}

// Coolest before dawn, warmest mid-afternoon. The swing averages out to zero
// across a full day, so the daily mean stays the number above.
function soilTemperatureAt(daysBeforeAsOf: number, localHour: number): number {
	const swing = 2.4 * Math.cos(((localHour - 15) / 24) * 2 * Math.PI);
	return round(soilTemperatureMean(daysBeforeAsOf) + swing);
}

function rainChance(daysAfterAsOf: number, localHour: number): number {
	let peak = 20;
	if (daysAfterAsOf === 0) {
		peak = 10;
	}
	else if (daysAfterAsOf === 1) {
		peak = 70;
	}
	return localHour >= 10 && localHour <= 18 ? peak : Math.round(peak / 2);
}

const HOURS = Array.from({ length: 24 }, (_unused, hour) => hour);

const observedSoil = Array.from({ length: PLAN_WINDOW_DAYS }, (_unused, index) => {
	const daysBeforeAsOf = PLAN_WINDOW_DAYS - 1 - index;
	const localDate = shiftDate(asOf, -daysBeforeAsOf);
	return HOURS.map(hour => ({
		observedAt: utcInstant(localDate, hour),
		variable: 'soil-temperature',
		depthCm: 6,
		value: soilTemperatureAt(daysBeforeAsOf, hour),
		unit: 'F',
		basis: 'observed',
		provenance: 'modeled',
		source: 'open-meteo',
		station: null,
	}));
}).flat();

/*
 * One probe reading taken by hand the morning before the as-of date, sitting
 * in the same hour as the modeled value for that hour rather than replacing
 * it. Both are Observations and the fixture keeps both, because choosing
 * between them within a day is a Planner decision and it cannot be exercised
 * unless the day holds the two.
 */
const probedSoil = [{
	observedAt: utcInstant(shiftDate(asOf, -1), 8),
	variable: 'soil-temperature',
	depthCm: 6,
	value: 67.4,
	unit: 'F',
	basis: 'observed',
	provenance: 'measured',
	source: 'manual',
	station: 'backyard-probe',
}];

const forecastSoil = Array.from({ length: FORECAST_DAYS }, (_unused, index) => {
	const localDate = shiftDate(asOf, index + 1);
	return HOURS.map(hour => ({
		observedAt: utcInstant(localDate, hour),
		variable: 'soil-temperature',
		depthCm: 6,
		value: round(soilTemperatureAt(0, hour) - (index + 1) * 0.8),
		unit: 'F',
		basis: 'forecast',
		provenance: 'modeled',
		source: 'open-meteo',
		station: null,
	}));
}).flat();

const forecastRain = Array.from({ length: FORECAST_DAYS }, (_unused, index) => {
	const localDate = shiftDate(asOf, index + 1);
	return HOURS.map(hour => ({
		observedAt: utcInstant(localDate, hour),
		variable: 'precipitation-probability',
		depthCm: null,
		value: rainChance(index, hour),
		unit: 'percent',
		basis: 'forecast',
		provenance: 'modeled',
		source: 'open-meteo',
		station: null,
	}));
}).flat();

/**
 * Hourly and only hourly, across the `PLAN_WINDOW_DAYS` trailing days ADR 0003
 * fixes the window at, plus a forecast tail past the as-of date. Nothing
 * upstream of the
 * Planner reduces these to a daily figure, so a fixture built out of daily
 * values would hand the Planner an input it will never be given and skip the
 * aggregation it exists to do.
 */
export const observations: Observation[] = parseWith(
	z.array(observationSchema),
	'planner fixtures: observations',
)([...observedSoil, ...probedSoil, ...forecastSoil, ...forecastRain]);

/**
 * `chemical` sits on both lists on purpose. It keeps the pre-emergent and the
 * feeding off the Away Card whatever their own `delegable` field says, and it
 * sorts them to the top of the Plan, which are two separate consequences a
 * single tag happens to carry here.
 */
export const tagPolicy: TagPolicy = parseWith(tagPolicySchema, 'planner fixtures: tag policy')({
	neverDelegableTags: ['chemical'],
	safetyTags: ['chemical', 'ladder'],
});
