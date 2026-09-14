import type { Artifact, StatusRecord } from '@/artifact/artifact';
import type { Rule, TagPolicy } from '@/rules/rule';
import { approachingArtifact, failingStatus, narratedArtifact, okStatus } from '@/artifact/fixtures';
import { isDelegable } from '@/planner/delegation';
import { taskId } from '@/planner/task';
import { seedRules, seedTagPolicy } from '@/seed';

/*
 * The Away Card renders a Task exactly when it is both fired and delegable.
 * Everything else in this Plan is withheld into one of two buckets, both
 * read off stamped fields and never off `tags`: owner-only (fired but not
 * delegable) and deferred. `approachingAwayArtifact` covers the
 * third case, where there is no work yet to sort into either bucket.
 *
 * Five Tasks on `awayArtifact`, each one there to make a different failure
 * impossible:
 *   - a delegable, fired, narrated Task—what the card actually renders.
 *   - a delegable, fired, un-narrated twin—exercises the `title` fallback
 *     ADR 0001 calls a real deliverable.
 *   - a deferred, delegable Task—proves deferral comes from `status`, and
 *     that a Guard's `release` string lands on the Task's `releaseWhen`
 *     verbatim.
 *   - a fired, chemical-tagged Task whose own Rule sets `delegable: true`,
 *     which proves the tag policy narrows the stamped flag rather than a
 *     view re-deriving it from tags. This is #15's central case.
 *   - a fired, undelegable Task with no safety tag—the gap
 *     `src/artifact/fixtures.ts` names in its own comments but cannot close
 *     itself, because no seed Rule is undelegable without also being
 *     chemical. Without this row, a renderer keyed on the `chemical` tag
 *     would render identically to one keyed on the `delegable` flag and pass
 *     every test.
 *
 * Rows 1, 3 and 4 get their `delegable` value by calling `isDelegable`
 * against the real seed Rule and tag policy, the way `projectedCrossing` in
 * `src/artifact/fixtures.ts` derives its Citation instead of asserting one:
 * a fixture whose comment states a premise the data does not back is worse
 * than no fixture. `mustBeDelegable` and `mustStayUndelegable` below throw at
 * import time, naming the Rule, if the seed ever stops backing that story.
 */

/** The Plan's own `asOf`, read off the Artifact rather than retyped, so a rendered date that drifts from it fails a test instead of a manual grep. */
export const AWAY_ASOF = narratedArtifact.plan.asOf;

/** Ids come from `taskId` rather than string literals: a hand-typed one drifts from the function the Planner and the store both key on. */
export const delegableNarratedTaskId = taskId('last-nitrogen', 'front-lawn');
export const delegableUnnarratedTaskId = taskId('deep-water-fig', 'fig-1');
export const deferredDelegableTaskId = taskId('esperanza-feeding', 'esperanza-1');
export const chemicalTaskId = taskId('fall-pre-emergent', 'front-lawn');
export const undelegableNoTagTaskId = taskId('mulch-around-the-fig', 'fig-1');

/** A renamed or removed seed Rule should break this file loudly at import time rather than hand a Task builder `undefined`. */
function seedRule(id: string): Rule {
	const rule = seedRules.find(candidate => candidate.id === id);
	if (rule === undefined) {
		throw new Error(`seed rule '${id}' is missing: away/fixtures.ts reads it by id to build a Task off it`);
	}
	return rule;
}

/** `esperanza-feeding`'s deferral names the Guard's own `release` string. Reading it off the seed, rather than retyping it, is what keeps the two from drifting apart the day someone edits the Guard's wording. */
function seedGuardRelease(id: string): string {
	const rule = seedRule(id);
	if (rule.kind !== 'guard' || rule.effect !== 'defer') {
		throw new Error(`seed rule '${id}' is not a deferring guard: the deferral fixture reads its release string verbatim off it`);
	}
	return rule.release;
}

/** `last-nitrogen` and `esperanza-feeding` are the fixture's delegable Tasks only because the seed Rule and tag policy actually agree they are. If either ever stopped, the fixture would be asserting a premise its own data no longer holds. */
function mustBeDelegable(rule: Rule, tagPolicy: TagPolicy): true {
	const delegable = isDelegable(rule, tagPolicy);
	if (!delegable) {
		throw new Error(`seed rule '${rule.id}' came back undelegable: the fixture built a delegable Task on the opposite premise`);
	}
	return delegable;
}

/**
 * The premise behind #15's central case: `fall-pre-emergent` stays
 * undelegable even with its own `delegable` field forced to `true`, because
 * `seedTagPolicy.neverDelegableTags` narrows a chemical-tagged Rule and never
 * defers to what the Rule itself claims. If this ever came back `true`,
 * `isDelegable` stopped narrowing on `chemical` and the Away Card would have
 * no way left to keep herbicide off the household's list.
 */
function mustStayUndelegable(rule: Rule, tagPolicy: TagPolicy): false {
	const delegable = isDelegable({ ...rule, delegable: true }, tagPolicy);
	if (delegable) {
		throw new Error(`seed rule '${rule.id}' came back delegable after forcing its own delegable field to true: neverDelegableTags stopped narrowing it`);
	}
	return delegable;
}

const lastNitrogenRule = seedRule('last-nitrogen');
const esperanzaFeedingRule = seedRule('esperanza-feeding');
const fallPreEmergentRule = seedRule('fall-pre-emergent');

/** An Artifact built for the Away Card's specs: one Plan carrying the five Tasks above, narrated for two of them. */
export const awayArtifact: Artifact = {
	...narratedArtifact,
	plan: {
		...narratedArtifact.plan,
		tasks: [
			{
				id: delegableNarratedTaskId,
				ruleId: 'last-nitrogen',
				plantId: 'front-lawn',
				status: 'fired',
				citation: { kind: 'window', date: AWAY_ASOF },
				deferrals: [],
				annotations: [],
				delegable: mustBeDelegable(lastNitrogenRule, seedTagPolicy),
				tags: ['lawn', 'fertilizer', 'nitrogen'],
				title: 'Put down the last nitrogen of the year on the front lawn',
			},
			{
				id: delegableUnnarratedTaskId,
				ruleId: 'deep-water-fig',
				plantId: 'fig-1',
				status: 'fired',
				citation: { kind: 'cadence', lastOccurrenceId: 'deep-water-fig-2026-08-20', elapsedDays: 22 },
				deferrals: [],
				annotations: [],
				// No seed Rule holds `deep-water-fig`, the way `src/artifact/fixtures.ts`'s own
				// deferred Task for this Rule has none either—it is a literal here because
				// there is nothing to call `isDelegable` against. `true` for the same reason
				// that fixture gives it: plain watering, no chemical tag, nothing a tag policy
				// would ever narrow.
				delegable: true,
				tags: ['watering'],
				title: 'Deep water the fig',
			},
			{
				id: deferredDelegableTaskId,
				ruleId: 'esperanza-feeding',
				plantId: 'esperanza-1',
				status: 'deferred',
				citation: { kind: 'cadence', lastOccurrenceId: 'esperanza-feeding-2026-08-10', elapsedDays: 32 },
				deferrals: [
					{ guardId: 'rain-expected', releaseWhen: seedGuardRelease('rain-expected') },
				],
				annotations: [],
				delegable: mustBeDelegable(esperanzaFeedingRule, seedTagPolicy),
				tags: ['container', 'fertilizer'],
				title: 'Feed the Esperanza',
			},
			{
				id: chemicalTaskId,
				ruleId: 'fall-pre-emergent',
				plantId: 'front-lawn',
				status: 'fired',
				citation: { kind: 'window', date: AWAY_ASOF },
				deferrals: [],
				annotations: [],
				delegable: mustStayUndelegable(fallPreEmergentRule, seedTagPolicy),
				tags: ['lawn', 'herbicide', 'chemical'],
				title: 'Apply fall pre-emergent to the front lawn',
			},
			{
				id: undelegableNoTagTaskId,
				ruleId: 'mulch-around-the-fig',
				plantId: 'fig-1',
				status: 'fired',
				citation: { kind: 'cadence', lastOccurrenceId: 'mulch-around-the-fig-2026-03-10', elapsedDays: 185 },
				deferrals: [],
				annotations: [],
				// The row `src/artifact/fixtures.ts` names but cannot supply: undelegable with
				// no safety tag at all. Every other undelegable Task here and there carries
				// `chemical`, so a renderer that filtered on that tag instead of on this flag
				// would render identically and pass every other test in this file.
				delegable: false,
				tags: ['mulch', 'tree'],
				title: 'Spread mulch around the fig',
			},
		],
	},
	narration: {
		summary: 'One more round of fertilizer for the front lawn before it turns cold, plus a weed preventer going down at the same time. The rest can wait.',
		// Only the two fired, narrated rows get prose. Leaving the delegable
		// Esperanza Task and the two Rule-less rows out is what proves a
		// withheld Task's prose never reaches the card even when the model
		// wrote some, and what leaves the `title` fallback something to do.
		tasks: [
			{ taskId: delegableNarratedTaskId, text: 'Give the front lawn its last round of fertilizer for the year.' },
			{ taskId: chemicalTaskId, text: 'The front lawn also needs its fall weed preventer put down this week.' },
		],
		advisories: [
			{ text: 'The gutters looked full in last week\'s photos. Worth a look next time someone is up on a ladder.' },
		],
	},
	narrated: true,
};

/**
 * The same Plan with the model switched off, mirroring `unnarratedArtifact`'s
 * relationship to `narratedArtifact`. Row 1 has no prose to fall back from
 * here, which is the un-narrated state #15's acceptance criteria name: the
 * card renders its `title` instead.
 */
export const unnarratedAwayArtifact: Artifact = {
	...awayArtifact,
	generatedAt: '2026-09-11T11:04:09Z',
	narration: null,
	narrated: false,
};

/**
 * The week where the card has nothing to hand over and still has something to
 * say: every fired Task is the owner's, and one more sits deferred. An
 * ordinary September looks like this the moment the only work in season is
 * chemical.
 *
 * It is the combination #15's withheld count was written for, and the one a
 * card can get wrong in the most expensive way, by reporting an empty list as
 * an untroubled yard. Narration is filtered to the Tasks that survive, because
 * ADR 0001 lets the model select from a Plan and never lets it name a Task the
 * Plan does not hold.
 */
const nothingDelegableTasks = awayArtifact.plan.tasks.filter(task => !(task.status === 'fired' && task.delegable));

export const nothingDelegableAwayArtifact: Artifact = {
	...awayArtifact,
	plan: { ...awayArtifact.plan, tasks: nothingDelegableTasks },
	narration: awayArtifact.narration === null
		? null
		: {
				...awayArtifact.narration,
				tasks: awayArtifact.narration.tasks.filter(
					entry => nothingDelegableTasks.some(task => task.id === entry.taskId),
				),
			},
};

/**
 * The single-Task Plan whose status is `approaching`. CONTEXT.md's
 * Approaching Task entry is why it renders apart from fired work and why
 * counting it would be wrong: there is no work to do yet. Spread untouched—`approachingArtifact`
 * already carries a Citation whose projected day this
 * file has no reason to relitigate.
 */
export const approachingAwayArtifact: Artifact = {
	...approachingArtifact,
};

/** The record beside a run that published, with `artifactGeneratedAt` read off `awayArtifact` rather than retyped so the pair cannot drift apart. */
export const awayStatus: StatusRecord = {
	...okStatus,
	artifactGeneratedAt: awayArtifact.generatedAt,
};

/** Three failed runs in a row against the same Artifact—the loud state the Away Card's staleness banner renders. The band itself comes from `generatedAt` against a pinned clock in the spec that reads this, not from anything stored here. */
export const failingAwayStatus: StatusRecord = {
	...failingStatus,
	artifactGeneratedAt: awayArtifact.generatedAt,
};
