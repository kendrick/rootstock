import type { Artifact } from '@/artifact/artifact';
import type { Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import {
	approachingArtifact,
	approachingTaskId,
	narratedArtifact,
	unnarratedArtifact,
} from '@/artifact/fixtures';
import { seedPlants, seedRules } from '@/seed';

export { failingStatus, okStatus } from '@/artifact/fixtures';

/*
 * The This Week route has no sparkline: nothing on the page draws a line over
 * `Plan.window`, only `CitationDisclosure` reading one Task's own Citation at a
 * time. `src/artifact/fixtures.ts` keeps the approaching Task on a separate
 * spring Plan for exactly the reason a sparkline would care about—drawing
 * September's window and a spring projection on one axis would contradict
 * itself. That reason has nothing to bite on here, so this file does the thing
 * the frozen fixture's own comment says not to do to *it*: it puts all three
 * statuses on one Plan. Do not read this as the frozen file having gotten the
 * separation wrong; a future sparkline in this component is the signal to
 * split this fixture back apart, not to edit `src/artifact/fixtures.ts`.
 */
const approachingTask = approachingArtifact.plan.tasks.find(task => task.id === approachingTaskId);
if (approachingTask === undefined) {
	throw new Error(`approachingArtifact has no Task with id '${approachingTaskId}': the combined fixture below has nothing to lift`);
}

/**
 * One Plan carrying a fired pair, a deferred Task, and the lifted approaching
 * Task, spread from the frozen September Artifact rather than retyped. The
 * narration is untouched, so the one advisory and the narrated/unnarrated
 * pairing both travel with it—see the module comment above for why the
 * mismatched window is not a bug.
 */
export const combinedNarratedArtifact: Artifact = {
	...narratedArtifact,
	plan: {
		...narratedArtifact.plan,
		tasks: [...narratedArtifact.plan.tasks, approachingTask],
	},
};

/**
 * The same four Tasks with the model switched off, spread from the frozen
 * `unnarratedArtifact` so `narration: null` and `narrated: false` come from
 * the one place that already proves the pair stays honest, rather than being
 * retyped here where a future edit to one could drift from the other.
 *
 * Neither variant narrates the approaching Task or the delegable nitrogen
 * Task—`narratedArtifact`'s own narration already leaves the nitrogen Task
 * out on purpose, and the lifted approaching Task was never in that narration
 * to begin with. That gap is what a spec needs to exercise the `title`
 * fallback; closing it here would take that case away from every test that
 * reaches for it.
 */
export const combinedUnnarratedArtifact: Artifact = {
	...unnarratedArtifact,
	plan: combinedNarratedArtifact.plan,
};

function findSeedRule(id: string): Rule {
	const rule = seedRules.find(candidate => candidate.id === id);
	if (rule === undefined) {
		throw new Error(`seedRules has no rule '${id}': this-week fixtures expect the seed to still carry it`);
	}
	return rule;
}

function findSeedPlant(id: string): Plant {
	const plant = seedPlants.find(candidate => candidate.id === id);
	if (plant === undefined) {
		throw new Error(`seedPlants has no plant '${id}': this-week fixtures expect the seed to still carry it`);
	}
	return plant;
}

const REGION = { name: 'Southwest Fort Worth, Texas', hardinessZone: '8b' };

/**
 * `src/seed/rules.json` has no `deep-water-fig`: watering the fig by hand
 * has never gone through a Rule before this fixture, and #12's cadence
 * citation (`lastOccurrenceId: 'deep-water-fig-2026-08-24'`, `elapsedDays:
 * 18`) needs a real Cadence Rule behind it to render anything but the
 * unresolved-rule line. Typed as `Rule` rather than run through `ruleSchema`,
 * so a schema change breaks this file at compile time instead of silently
 * accepting a shape the real seed pipeline would reject.
 */
const deepWaterFigRule: Rule = {
	id: 'deep-water-fig',
	kind: 'cadence',
	name: 'Deep water the fig',
	region: REGION,
	source: { kind: 'owner', label: 'Owner\'s own practice', url: null },
	tags: ['watering'],
	delegable: true,
	priority: 50,
	appliesTo: { plantIds: ['fig-1'], plantTags: null, ruleTags: null },
	productLabel: null,
	everyDays: { min: 10, max: 14 },
	season: null,
	after: null,
};

/**
 * `src/seed/rules.json` also has no `water-in-after-application`: the frozen
 * Artifact's fired pre-emergent Task carries an Annotation naming it, and a
 * Guard has to exist for `rulesById` to resolve that Annotation's `guardId`
 * the same way it resolves the Task's own `ruleId`. An annotate Guard rather
 * than a defer one, because the frozen Task carries this as a note beside the
 * work, not as a reason the work waited.
 */
const waterInAfterApplicationRule: Rule = {
	id: 'water-in-after-application',
	kind: 'guard',
	name: 'Water in after application',
	region: REGION,
	source: {
		kind: 'extension',
		label: 'Texas A&M AgriLife Extension',
		url: 'https://agrilifeextension.tamu.edu/wp-content/uploads/2023/08/ESC-042-bermudagrass-lawn-management-calendar.pdf',
	},
	tags: ['lawn'],
	delegable: false,
	priority: -1,
	appliesTo: { plantIds: null, plantTags: null, ruleTags: ['herbicide'] },
	productLabel: null,
	condition: { kind: 'always' },
	effect: 'annotate',
	text: 'Water in with a quarter inch within 48 hours.',
};

/**
 * Every Rule a Task, a Deferral, or an Annotation in {@link combinedNarratedArtifact}
 * names: the four seed Rules reused by id rather than retyped, plus the two
 * authored above. `rulesById` below resolves every one of them—the
 * deliberately unresolved case lives only in {@link rulesByIdMissingDeepWaterFig}.
 */
export const rules: Rule[] = [
	findSeedRule('fall-pre-emergent'),
	findSeedRule('last-nitrogen'),
	findSeedRule('spring-pre-emergent'),
	findSeedRule('rain-expected'),
	deepWaterFigRule,
	waterInAfterApplicationRule,
];

/** The two Plants {@link combinedNarratedArtifact}'s Tasks name. */
export const plants: Plant[] = [
	findSeedPlant('front-lawn'),
	findSeedPlant('fig-1'),
];

export const rulesById: ReadonlyMap<string, Rule> = new Map(rules.map(rule => [rule.id, rule]));

export const plantsById: ReadonlyMap<string, Plant> = new Map(plants.map(plant => [plant.id, plant]));

/**
 * The one deliberate exception `rulesById`'s docblock promises: a copy with
 * `deep-water-fig` taken back out, for a spec that needs `TaskItem` or
 * `CitationDisclosure` to resolve a Task's Rule to null and render the
 * "not in the current rule set" line. This mirrors the real gap `data/
 * artifact.json` and `src/artifact/fixtures.ts` both ship with today—see the
 * plan's "A Task whose Rule the rule set does not carry"—rather than
 * inventing a gap that does not exist elsewhere in the system.
 */
export const rulesByIdMissingDeepWaterFig: ReadonlyMap<string, Rule> = new Map(
	[...rulesById].filter(([id]) => id !== 'deep-water-fig'),
);
