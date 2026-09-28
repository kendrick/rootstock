import type { Narration } from './narration';
import type { Plan } from '@/planner/plan';
import type { Rule } from '@/rules/rule';

/**
 * `Task.ruleId` must name a task-creating Rule (window, threshold, or
 * cadence). `Deferral.guardId`, `Annotation.guardId`, and
 * `guardChecks[].guardId` must each name a Guard, and a Guard is the one Rule
 * kind CONTEXT.md says creates no work. `@/planner/task`'s schemas carry all
 * four as bare strings and import nothing from `@/rules` to check either the
 * id or the role, so a ruleId that names a real Guard, or a guardId that
 * names a real task-creating Rule, would resolve against a same-space check
 * and still be wrong. #23 retired three Guards and came within one Citation
 * of publishing an Artifact naming Rules the seed no longer held, and
 * nothing failed.
 */
export function findUnresolvedRuleIds(plan: Plan, rules: readonly Rule[]): string[] {
	const taskCreatingIds = new Set(rules.filter(rule => rule.kind !== 'guard').map(rule => rule.id));
	const guardIds = new Set(rules.filter(rule => rule.kind === 'guard').map(rule => rule.id));

	const problems: string[] = [];
	for (const task of plan.tasks) {
		if (!taskCreatingIds.has(task.ruleId)) {
			problems.push(`task '${task.id}' ruleId '${task.ruleId}' does not name a task-creating Rule`);
		}
		for (const deferral of task.deferrals) {
			if (!guardIds.has(deferral.guardId)) {
				problems.push(`task '${task.id}' deferral guardId '${deferral.guardId}' does not name a Guard`);
			}
		}
		for (const annotation of task.annotations) {
			if (!guardIds.has(annotation.guardId)) {
				problems.push(`task '${task.id}' annotation guardId '${annotation.guardId}' does not name a Guard`);
			}
		}
		for (const check of task.guardChecks ?? []) {
			if (!guardIds.has(check.guardId)) {
				problems.push(`task '${task.id}' guardChecks guardId '${check.guardId}' does not name a Guard`);
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

/**
 * Mirrors `ArtifactGate`'s own condition for showing the "records changed
 * after this plan was made" notice. ADR 0007 lets a committed Plan legitimately
 * name a seed the build has since moved past: the site rebuilds on every push,
 * the Plan only on the next daily run, and a Rule retirement can't regenerate
 * the Artifact in CI to match. `findUnresolvedRuleIds` above only holds when
 * `plannedFrom` agrees with the build's own seed; once it doesn't, this is
 * what a reader sees instead of a Rule reference that quietly stopped resolving.
 */
export function showsPlannedFromNotice(plannedFrom: string | null, seedFingerprint: string): boolean {
	return plannedFrom !== null && plannedFrom !== seedFingerprint;
}
