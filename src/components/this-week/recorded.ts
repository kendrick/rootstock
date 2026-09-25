import type { Occurrence } from '@/planner/occurrence';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import { isCompleted } from '@/planner/completion';

/**
 * Which of the week's Tasks are recorded, and the day each record carries.
 *
 * One function because two places count the same thing: the Task list and the
 * shell's margin. Counted separately, a sign-off can leave the margin saying
 * three open beside a stub saying one of three. Both derive from this function,
 * so they can disagree only while one of them has not yet re-read the Store.
 *
 * The day is the latest matching Occurrence's UTC day, the same slice
 * `isCompleted` compares against, so the date a row prints is one completion
 * itself accepted.
 */
export function recordedDates(
	tasks: readonly Task[],
	occurrences: readonly Occurrence[],
	asOf: string,
	rulesById: ReadonlyMap<string, Rule>,
): ReadonlyMap<string, string> {
	const recorded = new Map<string, string>();

	for (const task of tasks) {
		if (!isCompleted(task, [...occurrences], asOf, rulesById.get(task.ruleId) ?? null)) {
			continue;
		}

		const latest = occurrences
			.filter(occurrence => occurrence.ruleId === task.ruleId && occurrence.plantId === task.plantId)
			.map(occurrence => occurrence.completedAt.slice(0, 10))
			.sort()
			.at(-1);

		if (latest !== undefined) {
			recorded.set(task.id, latest);
		}
	}

	return recorded;
}

export interface WeekCounts {
	/** Tasks a reader can sign off: everything but Approaching work. */
	signable: number;
	recorded: number;
	open: number;
	approaching: number;
}

/**
 * The one count of the week's work that the stub, the Closed mark and the
 * margin all read. Approaching work is counted apart, because it cannot be
 * signed off. Folded into "open", it would keep a finished week open in the
 * stub while the Closed mark said the week was done.
 */
export function weekCounts(tasks: readonly Task[], recordedIds: ReadonlySet<string>): WeekCounts {
	const signableTasks = tasks.filter(task => task.status !== 'approaching');
	const recorded = signableTasks.filter(task => recordedIds.has(task.id)).length;

	return {
		signable: signableTasks.length,
		recorded,
		open: signableTasks.length - recorded,
		approaching: tasks.length - signableTasks.length,
	};
}

const listeners = new Set<() => void>();

/**
 * Subscribes to "an Occurrence was just written from this page". Returns the
 * unsubscribe, which is the shape an effect cleanup wants.
 *
 * In-memory and per tab, deliberately. The margin and the Task list are two
 * readers of one browser Store in one document, and all the margin needs is a
 * nudge to re-read. A second tab is a second mount and reads the Store fresh.
 */
export function onRecorded(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Called once the Store has agreed an Occurrence exists, never before. */
export function announceRecorded(): void {
	for (const listener of listeners) {
		listener();
	}
}
