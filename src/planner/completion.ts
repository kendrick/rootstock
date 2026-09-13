import type { Occurrence } from './occurrence';
import type { Task } from './task';
import type { Rule, WindowRule } from '@/rules/rule';

/**
 * The day a Task's evidence begins: the earliest `completedAt` that could be
 * this cycle's work rather than the last one's. Null means no such day
 * resolves, and a Task with no evidence start reads unchecked.
 */
function evidenceStart(task: Task, asOf: string, rule: Rule | null): string | null {
	// An approaching Task is work nothing has called for yet, so no Occurrence
	// can have satisfied it. The status is checked here instead of being left to
	// the `threshold-projection` branch below because `taskSchema` does not tie
	// the status to the Citation kind. Only the Planner pairs them, and this
	// function is handed Tasks the Planner did not necessarily write.
	if (task.status === 'approaching') {
		return null;
	}

	switch (task.citation.kind) {
		case 'window':
			// A Rule of some other kind is the same unresolvable state as a missing
			// one: the Citation and the Rule the caller resolved disagree about what
			// this Task is, and nothing here can say which of them is right.
			return rule !== null && rule.kind === 'window' ? windowStart(rule, asOf) : null;
		case 'threshold':
			// The run of days that already satisfied the Rule. Work recorded before
			// the run began belongs to an earlier crossing of the same threshold.
			return task.citation.from;
		case 'cadence':
			// A Cadence Rule fires because enough days have elapsed since its
			// Anchor, so only work recorded today clears it. Yesterday's Occurrence
			// is the Anchor the Rule counted from, and reading it as evidence would
			// check off the Task it just produced.
			return asOf;
		case 'threshold-projection':
			return null;
	}
}

/**
 * The day the current pass through a window opened. `end < start` is the wrap
 * signal `dates.ts` documents. A mulch window running 12-01 through 02-28
 * opened last December for a January morning, so dating its evidence to this
 * year's 12-01 would put the opening eleven months in the future and read
 * every Occurrence behind it as too old to count.
 */
function windowStart(rule: WindowRule, asOf: string): string {
	const wraps = rule.end < rule.start;
	const openedLastYear = wraps && asOf.slice(5) < rule.start;
	const year = Number(asOf.slice(0, 4));

	return `${openedLastYear ? year - 1 : year}-${rule.start}`;
}

/**
 * Whether the yard already holds an Occurrence that counts as this Task being
 * done. This is the answer behind the checkbox on This Week, and the reason a
 * Task checked off yesterday is still checked this morning.
 *
 * The fourth argument corrects contract 7 rather than deviating from it. The
 * contract names a Window Rule's `start` as the evidence start, and the three
 * arguments it lists cannot reach it: a window Citation is
 * `{ kind: 'window', date: asOf }`, so it carries the day the Plan was
 * generated rather than the Rule's range, and a Task carries no window bounds
 * of its own. Reading `citation.date` would walk the evidence start forward
 * every night, and a Task checked off yesterday would come back unchecked this
 * morning, which is the reload-survival criterion failing by construction.
 *
 * The Rule arrives already resolved rather than as a map to look up in, and
 * that is the load-bearing half. The same resolution that returns null here is
 * the one driving the "not in the current rule set" line the interface renders
 * for a Task whose Rule the seed data does not carry. Resolve the Rule once in
 * the component and pass it down, and completion and presentation cannot
 * disagree. Hand this function the map and let it do its own lookup, and the
 * day the two diverge a Task renders as unresolvable while still reading as
 * checked.
 *
 * That is what makes the null case meaningful rather than defensive. A window
 * Task whose Rule cannot be found has no resolvable evidence start, so it
 * reads unchecked, and unchecked is the safe direction for work nobody can
 * prove was done. The threshold, cadence, and approaching branches ignore
 * `rule` entirely.
 */
export function isCompleted(
	task: Task,
	occurrences: Occurrence[],
	asOf: string,
	rule: Rule | null,
): boolean {
	const start = evidenceStart(task, asOf, rule);

	if (start === null) {
		return false;
	}

	// `(ruleId, plantId)` is the pair an Occurrence is filed under, so a feeding
	// recorded against the esperanza never checks off the same Rule's Task for
	// the fig.
	return occurrences.some(
		occurrence => occurrence.ruleId === task.ruleId
			&& occurrence.plantId === task.plantId
			// `completedAt` is a UTC instant, the evidence start is a local calendar
			// date, and this signature carries nothing to reconcile the two with.
			// Comparing UTC days moves the boundary by the yard's offset on the
			// opening day alone: west of UTC, work finished the evening before a
			// window opens counts as inside it. That is the side worth erring on,
			// because the Occurrence says the work happened.
			&& occurrence.completedAt.slice(0, 10) >= start,
	);
}
