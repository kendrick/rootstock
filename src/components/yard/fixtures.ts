import type { Artifact } from '@/artifact/artifact';
import type { Occurrence } from '@/planner/occurrence';
import type { Rule, ThresholdRule } from '@/rules/rule';
import type { Store } from '@/store/store';
import type { Plant, Yard } from '@/yard/plant';
import { approachingArtifact } from '@/artifact/fixtures';
import { seedPlants, seedRules, seedTagPolicy, seedYard } from '@/seed';
import { createFakeStore } from '@/store/fake-store';

/*
 * Fixtures for `src/components/yard/*.spec.tsx`, built on top of the seed
 * rather than hand-typed from nothing: the seed is the real yard (CONTEXT.md's
 * Seed data entry), so a fixture drawn from it exercises the same ids, tags,
 * and shapes a component sees in production instead of a parallel toy yard
 * that happens to typecheck.
 *
 * The seed alone does not cover every shape a component needs to render—it
 * carries no planted plant with a null position, and its Occurrences are shaped
 * for the Planner's cadence math rather than for a history list. The few
 * fixtures built by hand below exist to fill exactly those gaps, typed
 * explicitly against the frozen schemas so a schema change breaks this file at
 * compile time instead of at the first assertion that happens to touch the
 * changed field.
 */

export const yardFixture: Yard = seedYard;

function findPlant(id: string): Plant {
	const plant = seedPlants.find(candidate => candidate.id === id);
	if (plant === undefined) {
		throw new Error(`seed plants carry no plant '${id}': this fixture has nothing to point at.`);
	}
	return plant;
}

/** front-lawn: planted, `kind: 'lawn'`, and positioned on the yard photo. */
export const lawnPlant: Plant = findPlant('front-lawn');

/** fig-1: planted and positioned, the non-lawn counterpart to {@link lawnPlant}. */
export const figPlant: Plant = findPlant('fig-1');

/** A seed planned plant, `position: null` because it has never been sited. */
export const plannedPlant: Plant = findPlant('crossvine-1');

/*
 * The seed has no planted plant with a null position—every planted record
 * it ships is already sited on the yard photo—so a list view rendering a
 * planted-but-unplaced row needs one built by hand. Spread from esperanza-1
 * rather than assembled field by field, so everything but the three fields
 * that matter here (id, name, position) stays a real, schema-shaped plant.
 */
export const unplacedPlantedPlant: Plant = {
	...findPlant('esperanza-1'),
	id: 'fixture-unplaced-planted',
	name: 'Fixture: unplaced planted plant',
	position: null,
};

/** The seed's own plants, plus the one gap it leaves: a planted plant with no position. */
export const plantFixtures: Plant[] = [...seedPlants, unplacedPlantedPlant];

/** The seed's task-creating Rules and its Guards together, exactly as the Planner reads them. */
export const ruleFixtures: Rule[] = seedRules;

function findThresholdRule(id: string): ThresholdRule {
	const rule = seedRules.find(candidate => candidate.id === id);
	if (rule === undefined) {
		throw new Error(`seed rules carry no rule '${id}': the threshold fixture has nothing to narrow.`);
	}
	if (rule.kind !== 'threshold') {
		throw new Error(`seed rule '${id}' is a '${rule.kind}' rule, not a threshold rule: the threshold fixture has nothing to narrow.`);
	}
	return rule;
}

/** The seed's `spring-pre-emergent`, narrowed by id rather than cast, so a renamed or retyped seed rule fails here instead of downstream. */
export const thresholdRule: ThresholdRule = findThresholdRule('spring-pre-emergent');

/*
 * Spread from `approachingArtifact`, never `narratedArtifact`. `narratedArtifact`
 * is September's Plan, whose window falls from 78F to 64F—entirely above
 * `thresholdRule`'s 55F—so a sparkline drawn from that pairing would show the
 * threshold line sitting under every point in the series, as if the work had
 * already fired. `approachingArtifact` is the spring run: its window climbs
 * toward 55F, the observed days fall short of three consecutive at-or-above,
 * and the forecast crosses on a `projectedDate` a reader can find in the
 * series. ADR 0003 puts the window on the Plan that produced it, which is why
 * this is a second Artifact rather than a second Task grafted onto the first.
 */
export const yardArtifact: Artifact = { ...approachingArtifact };

/*
 * Three dates the seed's own `esperanza-feeding` cadence rule was carried out
 * on, against the esperanza it targets, so a history view sorting descending
 * has more than one row to sort. A Guard's id would not do here: CONTEXT.md
 * says a Guard creates no work, so no Occurrence can ever name one, and these
 * have to name a task-creating Rule instead.
 */
export const occurrenceFixtures: Occurrence[] = [
	{
		id: 'esperanza-feeding-2026-08-10',
		ruleId: 'esperanza-feeding',
		plantId: 'esperanza-1',
		completedAt: '2026-08-10T15:00:00Z',
		recordedAt: '2026-08-10T15:00:00Z',
		source: 'seed',
	},
	{
		id: 'esperanza-feeding-2026-07-05',
		ruleId: 'esperanza-feeding',
		plantId: 'esperanza-1',
		completedAt: '2026-07-05T15:00:00Z',
		recordedAt: '2026-07-05T15:00:00Z',
		source: 'seed',
	},
	{
		id: 'esperanza-feeding-2026-06-01',
		ruleId: 'esperanza-feeding',
		plantId: 'esperanza-1',
		completedAt: '2026-06-01T15:00:00Z',
		recordedAt: '2026-06-01T15:00:00Z',
		source: 'seed',
	},
];

/**
 * A `Store` seeded with the fixtures above, for a component test that needs
 * one behind a defaulted prop. `occurrences` defaults to
 * {@link occurrenceFixtures}; pass `[]` for a plant with no history.
 */
export function createYardStore(occurrences: Occurrence[] = occurrenceFixtures): Store {
	return createFakeStore({
		yard: yardFixture,
		plants: plantFixtures,
		rules: ruleFixtures,
		occurrences,
		tagPolicy: seedTagPolicy,
	});
}
