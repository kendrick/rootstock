import type { Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';

/**
 * What one Rule's `appliesTo` resolves to against the actual yard. The
 * Planner needs both halves at once: the ranked strength of the match, to
 * order Rules that could otherwise tie, and the concrete Plants to build
 * Tasks from.
 *
 * `plants: null` is not "no Plants matched" — it is the whole-yard case,
 * which the Planner turns into a single Task carrying a null plantId rather
 * than one Task per Plant. Collapsing that into an empty array would lose the
 * distinction the Planner depends on: a lawn-wide pre-emergent is one Task,
 * not zero and not one per plant in the yard.
 */
export interface RuleTargets {
	/** 3 when the Rule named plant ids, 2 when it selected by tag alone, 1 for the whole yard. */
	specificity: 1 | 2 | 3;
	/** The planted Plants the Rule reaches, or null when it applies to the whole yard and its Task carries a null plantId. */
	plants: Plant[] | null;
}

/**
 * Resolves which Plants a Rule reaches, and how specifically it named them.
 *
 * `appliesTo.ruleTags` is a Guard's own selector—it picks which Rules a Guard
 * reads, not which Plants a task-creating Rule reaches—so it plays no part
 * here. `guardTargets` in guard-targets.ts is where it does its work, over
 * Tasks that already exist. The two functions are the Plant half and the Rule
 * half of one question about `appliesTo`, which is what makes the field's
 * absence from this one a division of labour rather than a field nobody reads.
 * A task-creating Rule that happens to carry `ruleTags` (nothing stops one
 * from being authored that way) is resolved exactly as if the field were null:
 * not an error, because the field simply has no meaning for this question.
 *
 * `plantIds` and `plantTags` are read as a union rather than each vetoing a
 * Plant the other left out, because that is the only reading under which a
 * null selector truly contributes "no constraint" per `appliesToSchema`'s
 * doc comment — an intersection would make a null `plantIds` silently narrow
 * a tag match to nothing.
 *
 * A `status: 'planned'` Plant is dropped after matching rather than excluded
 * from the search, so naming one by id still counts toward nothing more than
 * an empty result — never an error — and never changes which specificity the
 * Rule reports. The Rule named it; the yard just hasn't put it in the ground.
 */
export function targets(rule: Rule, plants: Plant[]): RuleTargets {
	const { plantIds, plantTags } = rule.appliesTo;

	if (plantIds === null && plantTags === null) {
		return { specificity: 1, plants: null };
	}

	const specificity = plantIds === null ? 2 : 3;

	const matched = plants.filter(plant =>
		plant.status === 'planted'
		&& (
			(plantIds !== null && plantIds.includes(plant.id))
			|| (plantTags !== null && plant.tags.some(tag => plantTags.includes(tag)))
		),
	);

	return { specificity, plants: matched };
}
