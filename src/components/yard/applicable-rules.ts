import type { Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { targets } from '@/planner/targets';

/**
 * Whether a Rule's plant selectors reach this Plant.
 *
 * `targets()` is the Planner's own answer, so the union of `plantIds` and
 * `plantTags` and the drop of `planned` Plants only have to be right in one
 * place. It ignores `ruleTags` outright, which is what makes it usable for a
 * Guard as well: its docblock is explicit that a Rule carrying that field is
 * resolved as if the field were null, because `ruleTags` says nothing about
 * Plants.
 *
 * `plants: null` is the whole-yard case and not "matched nothing". A Rule with
 * no plant selector reaches every Plant, this one included, and reading the
 * null as a non-match would hide a lawn-wide Rule from every Plant it covers.
 */
function reachesPlant(rule: Rule, plant: Plant, plants: Plant[]): boolean {
	const { plants: matched } = targets(rule, plants);
	return matched === null || matched.some(candidate => candidate.id === plant.id);
}

/**
 * Resolves which Rules reach one Plant: the work the yard would ask for, and
 * the Guards that would hold that work back or mark it up.
 *
 * A Guard has to clear both halves of `appliesTo`, because that is what the
 * field means. `rule.ts` fixes the reading as OR inside a selector and AND
 * across them, so `plantIds`/`plantTags` choose the Plants and `ruleTags` then
 * narrows to the Rules the Guard has an opinion on. Checking only the plant
 * half hides `rain-expected`, which names no Plant at all and is the Guard
 * holding the lawn's herbicide until the rain passes—the one a reader most
 * needs, on the Plant it acts on. Skipping the `ruleTags` half instead lists
 * `water-in-after-application` on the esperanza, which carries no Rule tagged
 * `chemical`, so the Guard would sit there holding nothing.
 *
 * `guardTargets()` answers this same question against a Plan's Tasks, and this
 * is its Plant-shaped sibling. The difference is deliberate rather than a
 * second implementation: a Task exists only where a Rule fired on the planned
 * date, so asking through Tasks would drop a Guard whenever the work it holds
 * is out of season. A Plant's page is a standing answer, not today's.
 */
export function rulesFor(plant: Plant, rules: Rule[], plants: Plant[]): Rule[] {
	const authoring = rules.filter(rule => rule.kind !== 'guard' && reachesPlant(rule, plant, plants));

	return rules.filter((rule) => {
		if (rule.kind !== 'guard') {
			return authoring.includes(rule);
		}

		if (!reachesPlant(rule, plant, plants)) {
			return false;
		}

		// The Rule half. A null `ruleTags` constrains nothing, so the Guard reaches
		// this Plant on the strength of its plant selectors alone. Otherwise it has
		// to find one of its tags on a Rule that actually asks for work here.
		const { ruleTags } = rule.appliesTo;
		return ruleTags === null
			|| authoring.some(candidate => candidate.tags.some(tag => ruleTags.includes(tag)));
	});
}
