import type { Task } from './task';
import type { TagPolicy } from '@/rules/rule';

/**
 * A Task plus the two facts the sort needs that a Task does not carry: the
 * rank of the Rule's targeting and the Rule's own explicit priority.
 */
export interface OrderableTask {
	task: Task;
	specificity: 1 | 2 | 3;
	priority: number;
}

/**
 * Whether a Task counts as safety work: any of its own tags appears in the
 * TagPolicy's `safetyTags`. Reads `safetyTags` alone and never
 * `neverDelegableTags` — the two lists answer different questions about the
 * same tag, and letting this sort consult the delegability list would make a
 * Task's place in the Plan depend on who is allowed to do it rather than on
 * how dangerous it is to leave undone.
 */
function isSafetyTask(task: Task, tagPolicy: TagPolicy): boolean {
	return task.tags.some(tag => tagPolicy.safetyTags.includes(tag));
}

/**
 * Compares two possibly-absent strings with the absent one sorting last.
 * `DailyAggregate`'s own depth comparison in aggregate.ts makes the same
 * choice for the same reason: a bare `<` would read `null` as less than
 * every string and put the untargeted case first, which is backwards for
 * every field this sort touches a null on.
 */
function compareNullableLast(left: string | null, right: string | null): number {
	if (left === right) {
		return 0;
	}
	if (left === null) {
		return 1;
	}
	if (right === null) {
		return -1;
	}
	return left < right ? -1 : 1;
}

/**
 * Ranks a Plan's Tasks for the one place a person reads them top to bottom
 * and treats position as urgency. Five tiers, checked in order, because each
 * later one only matters once every earlier one has already tied.
 *
 * Safety is checked before specificity or priority, ahead of both, because
 * the tag policy is the yard's own standing word on what protects a person or
 * a structure. A Rule's author can misjudge how urgent their own Rule is; the
 * safety tag is not supposed to be something a low `priority` number can
 * accidentally outrank.
 *
 * `task.ruleId` breaks a tie left after specificity and priority both agree —
 * two Rules that happen to target the yard with the same rank and share a
 * priority number. The comparison is arbitrary, but it only has to be stable,
 * and a Rule's own id is the one string every Task already carries for it.
 *
 * The final `task.plantId` tier is what makes the sort total rather than
 * merely well-ordered by the tiers above it: two Tasks that still tie once
 * `ruleId` agrees — the several Tasks one tag-targeted Rule produces, one per
 * Plant it reached — would otherwise compare equal, and a comparator that
 * returns zero for two distinct Tasks lets the underlying sort fall back to
 * whichever order they happened to arrive in. That is exactly the dependence
 * on input order this function exists to remove, so the sort cannot stop
 * before this tier settles it.
 */
export function orderTasks(entries: OrderableTask[], tagPolicy: TagPolicy): Task[] {
	return [...entries]
		.sort((left, right) => {
			const leftIsSafety = isSafetyTask(left.task, tagPolicy);
			const rightIsSafety = isSafetyTask(right.task, tagPolicy);
			if (leftIsSafety !== rightIsSafety) {
				return leftIsSafety ? -1 : 1;
			}

			if (left.specificity !== right.specificity) {
				return right.specificity - left.specificity;
			}

			if (left.priority !== right.priority) {
				return left.priority - right.priority;
			}

			if (left.task.ruleId !== right.task.ruleId) {
				return left.task.ruleId < right.task.ruleId ? -1 : 1;
			}

			return compareNullableLast(left.task.plantId, right.task.plantId);
		})
		.map(entry => entry.task);
}
