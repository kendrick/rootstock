import type { StatusRecord } from '@/artifact/artifact';
import type { Occurrence } from '@/planner/occurrence';
import type { Plan } from '@/planner/plan';
import type { PlanInput } from '@/planner/planner';
import type { Rule, TagPolicy } from '@/rules/rule';
import type { SeedData } from '@/store/store';
import type { Location } from '@/weather/location';
import type { Observation } from '@/weather/observation';
import type { Plant, Yard } from '@/yard/plant';
import { z } from 'zod';
import { localDate } from '@/planner/dates';
import { occurrenceSchema } from '@/planner/occurrence';
import { plan } from '@/planner/planner';
import { ruleSchema, tagPolicySchema } from '@/rules/rule';
import { parseWith } from '@/validation/parse';
import { observationSchema } from '@/weather/observation';
import { plantSchema, yardSchema } from '@/yard/plant';

/*
 * A small, self-contained yard for the generation run's own tests, built
 * here rather than borrowed from `src/seed/`. The real seed is the yard
 * other tickets are actively editing, and coupling a run spec to it would
 * mean a Rule somebody adds to the actual property could silently change
 * what "one fired Task, one deferred Task, a non-empty window" means for a
 * test that has nothing to do with that Rule.
 *
 * The mix is deliberately thin: two Plants, three Rules that create work,
 * and one Guard. Each was chosen for something the run spec has to exercise.
 * One Task fires outright, one is held back by a Guard, one is delegable
 * beside a non-delegable twin, and the window is built from a series the
 * fixture Observations actually carry.
 */

/** The date the fixture Plan is built for, chosen for no reason beyond matching a real fall morning. */
const ASOF = '2026-09-11';

/** North Texas without saying so. See {@link fixtureLocation} for why the actual coordinates never appear. */
const region = { name: 'Fixture Town', hardinessZone: '8b' };

const ownerSource = { kind: 'owner' as const, label: 'House practice', url: null };

/**
 * The moment a generation run would call this "now". Local noon-ish in
 * `fixtureLocation.timeZone`, so `localDate` resolves it to {@link ASOF}
 * without landing on the neighbouring day—the run spec derives its
 * `asOf` from this value the same way the real runner would.
 */
export const fixtureNow: Date = new Date('2026-09-11T15:00:00Z');

/**
 * The property's location, standing in for what `readLocationFromEnv` would
 * read from the generation environment. `latitude` and `longitude` are
 * `0, 0` rather than the real pair: ADR 0004 keeps every coordinate out of
 * this public repository, including in a fixture, and a run's tests never
 * read either number for anything but the weather call this package fakes
 * away—`fixtureObservations` below stands in for what an Adapter would
 * have returned.
 */
export const fixtureLocation: Location = {
	latitude: 0,
	longitude: 0,
	timeZone: 'America/Chicago',
};

function shiftDate(date: string, days: number): string {
	const shifted = new Date(`${date}T00:00:00Z`);
	shifted.setUTCDate(shifted.getUTCDate() + days);
	return shifted.toISOString().slice(0, 10);
}

// Central Daylight Time as a fixed offset: every local hour this file builds
// falls inside it, and the changeover isn't until November. Turning a local
// hour into a correct UTC instant in general is the Planner's job, done
// through `timeZone`; this only has to produce instants that land on the
// days it claims to.
const CENTRAL_DAYLIGHT_OFFSET_HOURS = 5;

function utcInstant(date: string, localHour: number): string {
	const instant = new Date(`${date}T00:00:00Z`);
	instant.setUTCHours(localHour + CENTRAL_DAYLIGHT_OFFSET_HOURS);
	return `${instant.toISOString().slice(0, 19)}Z`;
}

/**
 * Two Plants, which is the fewest that lets a Guard scoped to one of them
 * prove it leaves the other alone. The lawn is what the Window and Threshold
 * Rules below target; the fig is what the Cadence Rule and its Guard target.
 */
export const fixturePlants: Plant[] = parseWith(z.array(plantSchema), 'generation fixtures: plants')([
	{
		id: 'front-lawn',
		name: 'Front lawn',
		kind: 'lawn',
		status: 'planted',
		tags: ['lawn'],
		position: null,
		site: null,
		lawn: {
			grass: 'Bermuda',
			areaSqFt: 2000,
			soil: 'clay loam',
			irrigation: { schedule: 'Mornings before dawn', source: 'asserted' },
		},
		notes: null,
	},
	{
		id: 'fig-1',
		name: 'Fixture fig',
		kind: 'plant',
		status: 'planted',
		tags: ['fruit', 'watering'],
		position: null,
		site: null,
		lawn: null,
		notes: null,
	},
]);

/**
 * Three Rules that create work and one Guard, chosen so the run spec gets
 * one of each outcome it needs: `fall-checkup` fires on the calendar alone,
 * `soil-cool-down` fires off the Observations below, and `water-fig` fires
 * and is then held back by `hold-fig-watering`. `fall-checkup` and
 * `water-fig` are both authored `delegable: true`; `soil-cool-down` is not —
 * that split is what lets a later test tell the flag apart from a tag,
 * since none of the three carries one of `fixtureTagPolicy`'s
 * `neverDelegableTags`.
 */
export const fixtureRules: Rule[] = parseWith(z.array(ruleSchema), 'generation fixtures: rules')([
	{
		id: 'fall-checkup',
		name: 'Walk the front lawn for early fall issues',
		kind: 'window',
		region,
		source: ownerSource,
		tags: ['lawn'],
		delegable: true,
		priority: 10,
		appliesTo: { plantIds: ['front-lawn'], plantTags: null, ruleTags: null },
		productLabel: null,
		start: '09-01',
		end: '09-30',
	},
	{
		id: 'soil-cool-down',
		name: 'Soil has settled below 75F on the front lawn',
		kind: 'threshold',
		region,
		source: ownerSource,
		tags: ['lawn'],
		delegable: false,
		priority: 20,
		appliesTo: { plantIds: ['front-lawn'], plantTags: null, ruleTags: null },
		productLabel: null,
		variable: 'soil-temperature',
		depthCm: 6,
		aggregate: 'mean',
		comparison: 'lte',
		value: 75,
		unit: 'F',
		consecutiveDays: 2,
		published: null,
	},
	{
		id: 'water-fig',
		name: 'Deep water the fig',
		kind: 'cadence',
		region,
		source: ownerSource,
		tags: ['watering'],
		delegable: true,
		priority: 30,
		appliesTo: { plantIds: ['fig-1'], plantTags: null, ruleTags: null },
		productLabel: null,
		everyDays: { min: 7, max: 14 },
		season: null,
		after: null,
	},
	{
		id: 'hold-fig-watering',
		name: 'Hold fig watering until conditions are checked',
		kind: 'guard',
		region,
		source: ownerSource,
		tags: ['watering'],
		delegable: false,
		priority: 90,
		appliesTo: { plantIds: ['fig-1'], plantTags: null, ruleTags: null },
		productLabel: null,
		condition: { kind: 'always' },
		effect: 'defer',
		release: 'Release once the fig has actually been checked for dryness.',
	},
]);

/**
 * One watering older than `water-fig`'s own `everyDays.max`, so the Cadence
 * Rule fires (and reports itself overdue) rather than exercising the "never
 * recorded" branch. This package only needs a Task to exist for
 * `hold-fig-watering` to defer, and an overdue one says more about what the
 * Guard is holding back than a Rule nobody has ever run would.
 */
export const fixtureOccurrences: Occurrence[] = parseWith(z.array(occurrenceSchema), 'generation fixtures: occurrences')([
	{
		id: 'water-fig-2026-08-22',
		ruleId: 'water-fig',
		plantId: 'fig-1',
		completedAt: '2026-08-22T13:00:00Z',
		recordedAt: '2026-08-22T13:05:00Z',
		source: 'seed',
	},
]);

/**
 * No tag here is ever narrowed away from delegability or promoted to
 * safety. Both lists stay empty on purpose: `fixtureRules`' own
 * `delegable: true` / `delegable: false` split is what this package's tests
 * are meant to exercise, and a non-empty `neverDelegableTags` would leave a
 * reader unable to tell, from the fixture alone, which of the two
 * mechanisms actually produced a given Task's flag.
 */
export const fixtureTagPolicy: TagPolicy = parseWith(tagPolicySchema, 'generation fixtures: tag policy')({
	neverDelegableTags: [],
	safetyTags: [],
});

export const fixtureYard: Yard = parseWith(yardSchema, 'generation fixtures: yard')({
	id: 'fixture-yard',
	region,
	photo: null,
	overlays: [],
});

/**
 * Three trailing local days at 74F, which is the evidence `soil-cool-down`
 * reads: at or below its 75F line for the two days its `consecutiveDays`
 * asks for. Soil temperature is also the only series any Rule or Guard in
 * `fixtureRules` consults, so it is what makes `fixturePlan.window` come back
 * non-empty. Four readings a day is enough for `toDailyAggregates` to mean
 * out a stable daily figure, without dressing up a diurnal swing this fixture
 * has no use for.
 */
const SOIL_TEMPERATURE_DAY_OFFSETS = [-2, -1, 0];
const SOIL_TEMPERATURE_HOURS = [0, 6, 12, 18];

export const fixtureObservations: Observation[] = parseWith(
	z.array(observationSchema),
	'generation fixtures: observations',
)(SOIL_TEMPERATURE_DAY_OFFSETS.flatMap(offset =>
	SOIL_TEMPERATURE_HOURS.map(hour => ({
		observedAt: utcInstant(shiftDate(ASOF, offset), hour),
		variable: 'soil-temperature',
		depthCm: 6,
		value: 74,
		unit: 'F',
		basis: 'observed',
		provenance: 'modeled',
		source: 'open-meteo',
		station: null,
	})),
));

/** Everything above, bundled the way a Store is seeded. `SeedData` is the unenveloped shape, so these are the records themselves rather than anything the Store would file them in. */
export const fixtureSeed: SeedData = {
	yard: fixtureYard,
	plants: fixturePlants,
	rules: fixtureRules,
	occurrences: fixtureOccurrences,
	tagPolicy: fixtureTagPolicy,
};

/**
 * A prior run's record, carried forward with `consecutiveFailures` already
 * at 2 rather than 0—a run spec asserting that a fresh failure increments
 * the count needs a nonzero count to increment from, and a fixture that
 * shipped this at 0 could not tell "carried forward" apart from "reset".
 * `artifactGeneratedAt` still names a real prior Artifact's timestamp, per
 * `statusRecordSchema`'s doc comment: a run that failed does not erase the
 * file the site is still serving.
 */
export const fixturePreviousStatus: StatusRecord = {
	attemptedAt: '2026-09-10T11:04:11Z',
	ok: false,
	error: 'open-meteo: request timed out after 3 attempts',
	artifactGeneratedAt: '2026-09-09T11:04:07Z',
	consecutiveFailures: 2,
};

const fixtureInput: PlanInput = {
	asOf: localDate(fixtureNow.toISOString(), fixtureLocation.timeZone),
	timeZone: fixtureLocation.timeZone,
	plants: fixtureSeed.plants,
	rules: fixtureSeed.rules,
	observations: fixtureObservations,
	occurrences: fixtureSeed.occurrences,
	tagPolicy: fixtureSeed.tagPolicy,
};

/**
 * The Plan `plan()` actually returns over the bundle above, computed once at
 * import time rather than inside every spec that wants one—the same
 * discipline `src/artifact/fixtures.ts` applies in `projectedCrossing`. The
 * three checks below are this file checking its own story before anything
 * downstream trusts it: a fixture that quietly stopped producing a fired
 * Task, a deferred Task, or a non-empty window would still type-check and
 * would only be caught by whichever spec happened to assert on the missing
 * piece—or, worse, by none of them.
 */
function buildFixturePlan(): Plan {
	const result = plan(fixtureInput);

	if (!result.tasks.some(task => task.status === 'fired')) {
		throw new Error('generation fixtures: fixturePlan has no fired Task—the bundle above stopped producing work a spec can rely on.');
	}

	if (!result.tasks.some(task => task.status === 'deferred')) {
		throw new Error('generation fixtures: fixturePlan has no deferred Task—hold-fig-watering has stopped holding fig-watering back.');
	}

	if (result.window.length === 0) {
		throw new Error('generation fixtures: fixturePlan.window is empty—no Rule or Guard in the bundle is reading a series fixtureObservations carries.');
	}

	return result;
}

export const fixturePlan: Plan = buildFixturePlan();
