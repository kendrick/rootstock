import type { RuleVerdict } from './planner';
import type { WindowRule } from '@/rules/rule';
import { isWithinMonthDayRange } from './dates';

/**
 * A Window Rule reads only the calendar, never a reading, so there is no
 * partial evidence for it to report on the way there—the range either
 * contains today or it doesn't. That is what rules out 'approaching' here
 * even though `RuleVerdict` allows it: the status exists for a Threshold
 * Rule's trend line, and a Window Rule has no trend to be approaching.
 *
 * `end` sorting before `start` is not a malformed Rule; `winter-mulch-refresh`
 * is authored that way on purpose to cross New Year, and `isWithinMonthDayRange`
 * already carries the wrap logic. This function's only job is to hand `asOf`
 * to that primitive and turn the boolean back into the verdict shape the
 * Planner expects.
 */
export function evaluateWindowRule(rule: WindowRule, asOf: string): RuleVerdict {
	if (!isWithinMonthDayRange(asOf, rule.start, rule.end)) {
		return { fires: false };
	}

	return {
		fires: true,
		status: 'fired',
		citation: { kind: 'window', date: asOf },
		titleSuffix: null,
	};
}
