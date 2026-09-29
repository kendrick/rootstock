import type { Task } from '@/planner/task';
import type { Rule, WindowRule } from '@/rules/rule';
import { MONTHS } from '@/planner/dates';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Plan dates are local calendar days with no zone attached, so they're read as
 * UTC midnight and never meet the reader's clock. A card printed in another
 * zone would otherwise slide every date a day.
 */
function utc(date: string): Date {
	return new Date(`${date}T00:00:00Z`);
}

/** "Sep 28". Spelled by hand rather than by `Intl`, whose short forms add commas and vary by ICU build. */
export function shortDay(date: string): string {
	const day = utc(date);
	return `${MONTHS[day.getUTCMonth()]!.slice(0, 3)} ${day.getUTCDate()}`;
}

/**
 * The last day a Window Rule is still asking, in the year that pass through
 * the window ends. `end < start` is the wrap signal `dates.ts` documents: a
 * 12-01 → 02-28 window seen in December closes next February, and seen in
 * January closes this one.
 */
function windowEnd(rule: WindowRule, asOf: string): string {
	const year = Number(asOf.slice(0, 4));
	const wraps = rule.end < rule.start;
	const endYear = wraps && asOf.slice(5) >= rule.start ? year + 1 : year;
	const leap = (endYear % 4 === 0 && endYear % 100 !== 0) || endYear % 400 === 0;
	// A Feb 29 end in a common year would roll to Mar 1 and promise a day the
	// window doesn't have.
	const end = rule.end === '02-29' && !leap ? '02-28' : rule.end;

	return `${endYear}-${end}`;
}

/**
 * The deadline line under each row. Paper outlives the week it was printed in,
 * so a row has to say when it stops mattering.
 *
 * Only a Window Rule has a real last day. Cadence and Threshold work is due
 * now and stays due, so "This week" is the honest answer there. A window Task
 * whose Rule the seed no longer carries gets the same, because the earlier
 * deadline is the safe one to be wrong about.
 */
export function byWhen(task: Task, rule: Rule | null, asOf: string): string {
	if (task.citation.kind !== 'window' || rule === null || rule.kind !== 'window') {
		return 'This week';
	}

	const end = windowEnd(rule, asOf);
	return `By ${WEEKDAYS[utc(end).getUTCDay()]} ${shortDay(end)}`;
}

/**
 * `header.tsx`'s `No. <year>-<day of year>`, read off the Plan's date instead of
 * the clock. The owner's sheet numbers the day it's read. A stub numbers the
 * Plan it was torn from, so two copies of one week's card carry one number,
 * and the prerendered HTML can't disagree with the browser about it.
 */
export function ticketNumber(asOf: string): string {
	const day = utc(asOf);
	const dayOfYear = Math.round((day.getTime() - Date.UTC(day.getUTCFullYear(), 0, 0)) / 86_400_000);

	return `No. ${day.getUTCFullYear()}-${String(dayOfYear).padStart(3, '0')}`;
}
