import type { ThresholdRule } from '@/rules/rule';

/** UTC, because a season bound is a calendar day with no zone of its own. */
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** A season bound (`MM-DD`) as "Feb 1". Seasons recur, so they carry no year. */
export function seasonDay(monthDay: string): string {
	return DAY_FORMAT.format(Date.parse(`2000-${monthDay}T00:00:00Z`));
}

/**
 * Whether the Plan's date falls inside the Rule's season, wrapping the year
 * end for a season like Nov 15 to Feb 15. No season means always in season.
 */
export function inSeason(asOf: string, season: ThresholdRule['season']): boolean {
	if (season === null) {
		return true;
	}
	const day = asOf.slice(5);
	return season.start <= season.end
		? day >= season.start && day <= season.end
		: day >= season.start || day <= season.end;
}

/**
 * The day the Rule's season next opens, when the Plan's date falls outside it,
 * or null when the season is open or the Rule has none. The sheet folds an
 * out-of-season chart away behind this date.
 */
export function outOfSeasonUntil(asOf: string, rule: ThresholdRule): string | null {
	return rule.season === null || inSeason(asOf, rule.season) ? null : seasonDay(rule.season.start);
}
