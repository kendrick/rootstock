import type { Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { targets } from '@/planner/targets';

/**
 * Resolves which Rules reach one Plant, for a view that shows a Plant what
 * would act on it and what would hold that work back.
 *
 * The two Rule kinds are answered two different ways because the repo
 * already has a function for each question and reimplementing either would
 * risk drifting from it:
 *
 * - A task-creating Rule (window, threshold, cadence) reaches the Plant when
 *   `targets()` — the Planner's own answer to "which Plants does this Rule
 *   reach" — puts it in the result. Reusing it means the union of
 *   `plantIds`/`plantTags` and the drop of `planned` Plants only have to be
 *   right in one place.
 * - A Guard reaches the Plant when its `appliesTo.plantIds` names it.
 *   `guardTargets()` answers a related but different question — which Tasks
 *   a Guard reaches — and needs a Plan's Tasks to do it. This view has no
 *   Tasks in hand, only a Plant, so `guardTargets()` is the wrong tool here:
 *   reading `appliesTo.plantIds` directly is the only way to ask "does this
 *   Guard name this Plant" without first building Tasks just to throw them
 *   away.
 */
export function rulesFor(plant: Plant, rules: Rule[], plants: Plant[]): Rule[] {
	return rules.filter((rule) => {
		if (rule.kind === 'guard') {
			return rule.appliesTo.plantIds !== null && rule.appliesTo.plantIds.includes(plant.id);
		}

		const { plants: matched } = targets(rule, plants);

		// `plants: null` is targets()'s whole-yard case, not "matched nothing" —
		// a Rule with no plant selector at all reaches every Plant, this one
		// included. Reading it as a non-match would hide a lawn-wide rule from
		// every Plant's page.
		return matched === null || matched.some(candidate => candidate.id === plant.id);
	});
}
