import type { Task } from './task';
import type { GuardRule, Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';

/**
 * Whether a Task sits in the plant half of a Guard's `appliesTo`. The caller
 * only asks once at least one plant selector constrains, so a Task carrying
 * no `plantId` fails here: there is no Plant to compare against, and reading
 * that absence as a match would turn the fig's Guard into a yard-wide one.
 *
 * The two selectors union rather than each overruling what the other left out,
 * for the same reason `targets()` unions them. An intersection would let a
 * null `plantIds` silently narrow a tag match to nothing, when a null
 * selector is supposed to constrain nothing at all.
 *
 * A `plantId` naming a Plant nobody put in `plants` still matches `plantIds`,
 * because that half compares strings and never needs the record. The
 * `plantTags` half cannot match it, because there is no record to read tags
 * from. Neither case throws: a Guard is the wrong place to discover that the
 * inventory and the Plan disagree about which Plants exist.
 */
function inPlantGroup(
	task: Task,
	plantIds: string[] | null,
	plantTags: string[] | null,
	plants: Plant[],
): boolean {
	if (task.plantId === null) {
		return false;
	}

	if (plantIds !== null && plantIds.includes(task.plantId)) {
		return true;
	}

	if (plantTags === null) {
		return false;
	}

	const plant = plants.find(candidate => candidate.id === task.plantId);
	return plant !== undefined && plant.tags.some(tag => plantTags.includes(tag));
}

/**
 * Whether a Task's Rule carries one of the tags the Guard selects Rules by.
 * This reads the Rule's own tags, never the Task's, even though a Task
 * carries a `tags` array that usually holds the same strings. `ruleTags`
 * says which Rules a Guard has an opinion on, and a Task's tags are free to
 * drift from its Rule's, so reading the copy would make a Guard's reach
 * depend on how faithfully the Planner transcribed them.
 */
function inRuleGroup(task: Task, ruleTags: string[], rules: Rule[]): boolean {
	const rule = rules.find(candidate => candidate.id === task.ruleId);
	return rule !== undefined && rule.tags.some(tag => ruleTags.includes(tag));
}

/**
 * Resolves which of a Plan's Tasks one Guard reaches.
 *
 * This is the sibling of `targets()` and deliberately answers a different
 * question. That one resolves which Plants a task-creating Rule reaches. A
 * Guard creates no work, so by the time it runs the Tasks already exist and
 * the only question left is which of them it speaks to. The two must agree on
 * how `appliesTo` reads, which is why both union the plant selectors. The
 * difference is `ruleTags`: `targets()` ignores it outright because it says
 * nothing about Plants, and here it does half the work.
 *
 * `plantIds` and `plantTags` pick the plants, and `ruleTags` then narrows
 * what they picked, so a Task has to satisfy both halves. The reading to
 * reject is the whole-OR one, where any of the three selectors matching is
 * enough. The fig's "no fertilizer outside spring" Guard names
 * `plantIds: ['fig-1']` and `ruleTags: ['fertilizer']`, and under whole-OR it
 * would also reach the lawn's last nitrogen of the year, which is tagged
 * `fertilizer` and has nothing to do with the fig. September's lawn feeding
 * would land in the Plan already deferred, by a Guard written about a
 * different plant.
 *
 * A null selector does not constrain, per `appliesToSchema`. Two null plant
 * selectors drop the plant half out of the conjunction rather than matching
 * nothing, and that is the only way a Guard reaches the whole-yard Task a
 * Rule with no plant selector produces: that Task's `plantId` is null, and
 * null matches nothing in a plant group that does constrain. A Guard with all
 * three selectors null reaches every Task.
 *
 * Nothing here reads `status` or asks whether a Plant is planted. The Planner
 * settled both when it authored the Task, and asking again would let a Guard
 * quietly disagree with it about which work exists. ADR 0002 rules that out:
 * a Guard has no path to remove a Task, so it has no business deciding one
 * should not have been written.
 */
export function guardTargets(
	guard: GuardRule,
	tasks: Task[],
	rules: Rule[],
	plants: Plant[],
): Task[] {
	const { plantIds, plantTags, ruleTags } = guard.appliesTo;
	const plantGroupConstrains = plantIds !== null || plantTags !== null;

	return tasks.filter((task) => {
		if (plantGroupConstrains && !inPlantGroup(task, plantIds, plantTags, plants)) {
			return false;
		}

		return ruleTags === null || inRuleGroup(task, ruleTags, rules);
	});
}
