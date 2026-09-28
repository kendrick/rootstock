import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import { daysBetween } from '@/planner/dates';

/** How near a window's close counts as soon. Three days is one weekend's warning. */
export const CLOSING_SOON_DAYS = 3;

export interface ClosingSoon {
	task: Task;
	/** The last day of the Rule's window, as YYYY-MM-DD. */
	closes: string;
	/** Days from the Plan's date to the close. 0 means it closes that day. */
	daysLeft: number;
}

/**
 * The window a date falls in closes on `end` in the same year, unless the
 * window wraps the year and the date sits in its first half, before New Year.
 */
function closingDate(asOf: string, start: string, end: string): string {
	const year = Number(asOf.slice(0, 4));
	const wrapsAndBeforeNewYear = start > end && asOf.slice(5) >= start;

	return `${wrapsAndBeforeNewYear ? year + 1 : year}-${end}`;
}

/**
 * Window work about to lose its window, measured from the Plan's own date
 * rather than the clock. Counted from the clock it would be a figure baked into
 * the static export and wrong by the next morning; counted from the Plan it's a
 * fact about the Plan, and the staleness banner already says how old that is.
 *
 * Fired and held work both count. Held work is the case this exists for: a
 * Guard deferring a Task whose window closes in two days is two Rules about to
 * collide, and the ticket otherwise prints it last, in its own section.
 * Approaching work has no window to lose.
 */
export function closingSoon(
	tasks: readonly Task[],
	rulesById: ReadonlyMap<string, Rule>,
	asOf: string,
	within = CLOSING_SOON_DAYS,
): ClosingSoon[] {
	return tasks.flatMap((task): ClosingSoon[] => {
		const rule = rulesById.get(task.ruleId);
		if (task.status === 'approaching' || task.citation.kind !== 'window' || rule?.kind !== 'window') {
			return [];
		}

		const closes = closingDate(asOf, rule.start, rule.end);
		const daysLeft = daysBetween(asOf, closes);

		return daysLeft >= 0 && daysLeft <= within ? [{ task, closes, daysLeft }] : [];
	});
}
