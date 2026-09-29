import type { DailyAggregate } from '@/planner/plan';
import type { Rule } from '@/rules/rule';
import { AGGREGATE_TEXT, formatValue, VARIABLE_TEXT } from '@/components/series-text';
import { roundKeepingSide } from '@/planner/aggregate';
import { forecastDays, rainChanceDays } from '@/planner/guard-conditions';
import { dayOfMonth } from './citation-line';

/**
 * The readings behind a Guard's verdict, as one evidence line. A Deferral that
 * says "Held back by Rain expected" with no numbers under it is the "Why this?"
 * link this product exists to refuse: the reader has to go and find a forecast
 * to judge it. Null when the Guard reads no series (a house rule or a calendar
 * range settles on the date alone) or when the window holds none of its days.
 *
 * The Guard comes from the current rule set, not the Plan, because a Deferral
 * carries only the Guard's id and release text. Where the rule set has moved
 * since the Plan was made, ArtifactGate already says so above the ticket.
 */
export function guardEvidence(guard: Rule | undefined, window: readonly DailyAggregate[], asOf: string): string | null {
	if (guard?.kind === 'guard' && guard.condition.kind === 'forecast-reaches') {
		const { condition } = guard;
		const days = forecastDays(condition, [...window], asOf);
		if (days.length === 0) {
			return null;
		}

		// Kept on its side of the Guard's value, so a forecast of 89.96 under a 90°F hold doesn't print as the line itself.
		const readings = days.map(day => `${dayOfMonth(day.date)} ${formatValue(roundKeepingSide(day.value, [condition.value]), day.unit)}`);
		return `Forecast ${AGGREGATE_TEXT[condition.aggregate]} ${VARIABLE_TEXT[condition.variable]} ${readings.join(' / ')}`;
	}

	if (guard?.kind !== 'guard' || guard.condition.kind !== 'no-rain-within') {
		return null;
	}

	const days = rainChanceDays(guard.condition, [...window], asOf);
	if (days.length === 0) {
		return null;
	}

	return `Rain chance ${days.map(day => `${dayOfMonth(day.date)} ${Math.round(day.value)}%`).join(' / ')}`;
}

/**
 * The first day, on or before `by`, the Guard reads a rain chance at or past
 * its own line: the day a held Task's release can't come before its window
 * closes. Null when the Guard isn't a rain Guard or no such day is in reach.
 * It reads the same days the verdict read and nothing the forecast says after.
 */
export function rainBefore(
	guard: Rule | undefined,
	window: readonly DailyAggregate[],
	asOf: string,
	by: string,
): { date: string; chance: number } | null {
	if (guard?.kind !== 'guard' || guard.condition.kind !== 'no-rain-within') {
		return null;
	}

	const { probabilityAtLeast } = guard.condition;
	const day = rainChanceDays(guard.condition, [...window], asOf)
		.find(candidate => candidate.date <= by && candidate.value >= probabilityAtLeast);

	return day === undefined ? null : { date: day.date, chance: Math.round(day.value) };
}
