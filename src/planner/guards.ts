import type { GuardVerdict } from './guard-conditions';
import type { DailyAggregate } from './plan';
import type { Task } from './task';
import type { GuardRule, Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { evaluateGuardCondition } from './guard-conditions';
import { guardTargets } from './guard-targets';

/**
 * What a Guard leaves on a Task when the evidence it needed never turned up.
 *
 * It is a constant because the interface has to tell this annotation apart
 * from a Guard's own authored text, and matching the sentence downstream is
 * how that recognition rots the first time somebody rewords it.
 *
 * The wording owes the reader two things inside one Away Card line: that
 * nobody checked, and that the work is going ahead regardless. Either half on
 * its own misleads. "Forecast unavailable" reads as a footnote, and "not held
 * back" reads as an all-clear.
 */
export const FORECAST_UNAVAILABLE_TEXT = 'Could not check the forecast, so this was not held back. Look at the sky before you start.';

/**
 * A Task copied deeply enough that the copy's arrays belong to the copy.
 *
 * The array spreads are what the shallow version gets wrong. A spread of the
 * Task alone hands the copy the same `deferrals` and `annotations` arrays the
 * original holds, so anything downstream that appends to a returned Task
 * writes straight into the Plan this function was handed, and the counts and
 * the ids all still match.
 */
function copyTask(task: Task): Task {
	return { ...task, deferrals: [...task.deferrals], annotations: [...task.annotations] };
}

/**
 * Applies one Guard's verdict to one Task, returning a Task rather than
 * writing to the one it was given.
 *
 * Returning is what makes the switch exhaustive: every branch owes a Task, so
 * a fourth `GuardVerdict` added upstream fails to compile here. A version that
 * wrote to its argument would return nothing, and the same fourth verdict
 * would fall through the switch and release the work in silence.
 *
 * 'unavailable' annotates whichever effect the Guard carries. A defer Guard
 * has no evidence to hold work on, and an annotate Guard has nothing it knows
 * to be true to say, so both land on the same sentence and the Guard's own
 * `text` goes unsaid.
 */
function guarded(task: Task, guard: GuardRule, verdict: GuardVerdict): Task {
	switch (verdict) {
		case 'unmet':
			return task;

		case 'unavailable':
			return {
				...task,
				annotations: [...task.annotations, { guardId: guard.id, text: FORECAST_UNAVAILABLE_TEXT }],
			};

		case 'met':
			if (guard.effect === 'annotate') {
				return {
					...task,
					annotations: [...task.annotations, { guardId: guard.id, text: guard.text }],
				};
			}

			return {
				...task,
				status: 'deferred',
				deferrals: [...task.deferrals, { guardId: guard.id, releaseWhen: guard.release }],
			};
	}
}

/**
 * Runs every Guard in the Rule set over the Tasks the other Rules authored,
 * and returns a fresh Task for each one it was handed.
 *
 * The result is the same length as the argument and in the same order. ADR
 * 0002 gives a Guard no path to remove a Task, and this is the function where
 * that guarantee either holds or quietly stops holding, so the shape of the
 * code carries it rather than a comment asking for it: the pass maps over the
 * Tasks once and filters nowhere, which leaves no branch a Task could fall out
 * of by accident. Nothing here reads the target Rule's `priority` either, so a
 * Rule cannot outrun a Guard by asking to go first.
 *
 * Guards read finished Tasks, so the pass cannot run before the Rules that
 * create them. Which side of the ordering it falls on is a weaker claim than
 * it looks: `orderTasks` ranks on tags, specificity and priority and never
 * reads `status`, so today the Plan comes out in the same order either way.
 * Running before the sort is what keeps that true by accident rather than by
 * arrangement, because it leaves the ranking the last thing applied and hands
 * a tier that does one day read `status` a Task whose deferrals are already
 * settled.
 *
 * Targeting is resolved against the Tasks as they arrived rather than against
 * the copies carrying earlier Guards' work. `guardTargets` reads `ruleId`,
 * `plantId` and the Rule set, none of which a Guard touches, so the two
 * readings agree today. Resolving against the originals is what keeps them
 * agreeing the day a Guard effect starts writing to a field targeting
 * consults. What it protects is that a Guard's reach never depends on which
 * Guards ran ahead of it, so reordering the Rule set changes the order of a
 * Task's deferrals and nothing else about the Plan.
 *
 * Each condition is evaluated once, ahead of the Tasks it applies to. A
 * condition reads the planned date and the window and knows nothing about any
 * Task, so evaluating it per Task would compute one answer N times and invite
 * the next reader to believe the answers could differ.
 *
 * 'unavailable' is the verdict the rest of this is built around. It means the
 * Planner could not check: the series was never collected, or the forecast
 * stops short of the Guard's horizon. Deferring on it holds work back on no
 * evidence, and doing nothing releases the work into a silence that reads
 * exactly like a clear sky. So the work is released and the Task carries the
 * annotation saying it was released unchecked, which is the only claim either
 * kind of Guard can honestly make there.
 *
 * A Task that arrives `approaching` and gets deferred comes back `deferred`.
 * `taskSchema` allows one status and requires `deferred` wherever a deferral
 * sits, so there is no combined state to put it in. The Task still carries its
 * projection Citation, and that is where the interface reads that the Rule has
 * not fired yet.
 */
export function applyGuards(
	tasks: Task[],
	rules: Rule[],
	plants: Plant[],
	window: DailyAggregate[],
	asOf: string,
): Task[] {
	const pass = tasks.map(task => ({ original: task, result: copyTask(task) }));

	for (const rule of rules) {
		if (rule.kind !== 'guard') {
			continue;
		}

		// Membership by object identity, because `guardTargets` returns the very
		// Tasks it was given. Matching on id instead would be a second opinion
		// about which Task is which, inside a function that already has one.
		const reached = new Set(guardTargets(rule, tasks, rules, plants));
		const verdict = evaluateGuardCondition(rule.condition, window, asOf);

		for (const entry of pass) {
			if (reached.has(entry.original)) {
				entry.result = guarded(entry.result, rule, verdict);
			}
		}
	}

	return pass.map(entry => entry.result);
}
