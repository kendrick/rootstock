import type { Narration } from './narration';
import type { Plan } from '@/planner/plan';

/**
 * `Task.ruleId`, `Deferral.guardId`, `Annotation.guardId`, and
 * `GuardCheck.guardId` all name a Rule by bare string id, and a Guard is a
 * Rule too (CONTEXT.md). None of those schemas import `@/rules` to check one
 * against, so this is the only place a retired ruleId or guardId gets
 * caught. #23 retired three Guards and came within one Citation of
 * publishing an Artifact naming Rules the seed no longer held, and nothing
 * failed.
 */
export function findUnresolvedRuleIds(plan: Plan, ruleIds: ReadonlySet<string>): string[] {
	const problems: string[] = [];
	for (const task of plan.tasks) {
		if (!ruleIds.has(task.ruleId)) {
			problems.push(`task '${task.id}' ruleId names unknown rule '${task.ruleId}'`);
		}
		for (const deferral of task.deferrals) {
			if (!ruleIds.has(deferral.guardId)) {
				problems.push(`task '${task.id}' deferral guardId names unknown rule '${deferral.guardId}'`);
			}
		}
		for (const annotation of task.annotations) {
			if (!ruleIds.has(annotation.guardId)) {
				problems.push(`task '${task.id}' annotation guardId names unknown rule '${annotation.guardId}'`);
			}
		}
		for (const check of task.guardChecks ?? []) {
			if (!ruleIds.has(check.guardId)) {
				problems.push(`task '${task.id}' guardChecks guardId names unknown rule '${check.guardId}'`);
			}
		}
	}
	return problems;
}

/**
 * Narration cites a Task, not a Rule: one Rule can fire for several Plants,
 * so a `taskId` is the precise handle (see `narration.ts`). `validateNarration`
 * already rejects a stray `taskId` at generation time, but only against the
 * Plan the run just built in memory. It never reads the committed file back
 * afterward, which is what this checks.
 */
export function findUnresolvedNarratedTaskIds(narration: Narration | null, plan: Plan): string[] {
	if (narration === null) {
		return [];
	}
	const taskIds = new Set(plan.tasks.map(task => task.id));
	return narration.tasks
		.filter(task => !taskIds.has(task.taskId))
		.map(task => `narration task references unknown task '${task.taskId}'`);
}
