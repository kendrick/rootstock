import type { Occurrence } from './occurrence';
import type { RuleVerdict } from './planner';
import type { CadenceRule } from '@/rules/rule';
import { daysBetween, isWithinMonthDayRange, localDate } from './dates';

/**
 * The Occurrence a Cadence Rule counts from: the most recent one matching the
 * anchor Rule id and the Plant this evaluation is for. "Most recent" means
 * greatest `completedAt`, not greatest `recordedAt`—a backfilled record
 * written days late still counts from when the work actually happened, per
 * `occurrence.ts`'s doc comment on why the two timestamps are kept apart.
 *
 * The `id` tiebreak exists only because two Occurrences can share a
 * `completedAt` to the second (a seed file authored by hand, say). Without a
 * total order the choice of anchor would depend on which one happened to
 * come first in the array, and this function would stop being deterministic
 * on identical input.
 */
function findAnchor(anchorRuleId: string, plantId: string | null, occurrences: Occurrence[]): Occurrence | null {
	let anchor: Occurrence | null = null;

	for (const occurrence of occurrences) {
		if (occurrence.ruleId !== anchorRuleId || occurrence.plantId !== plantId) {
			continue;
		}

		if (
			anchor === null
			|| occurrence.completedAt > anchor.completedAt
			|| (occurrence.completedAt === anchor.completedAt && occurrence.id > anchor.id)
		) {
			anchor = occurrence;
		}
	}

	return anchor;
}

/**
 * Decides whether a Cadence Rule fires for one Plant on one day.
 *
 * `rule.after` is what makes a split application possible without a second
 * calendar date that drifts away from the first every year: the anchor comes
 * from the OTHER rule's Occurrences, and a follow-up with nothing behind it
 * yet stays silent rather than inventing a start date for a job that hasn't
 * had its first half done. A plain cadence with no `after` has no such
 * dependency, so a missing Occurrence there means only that the work has
 * never been recorded, and that is itself something worth surfacing.
 *
 * The season check runs before the anchor search rather than after, because
 * `isWithinMonthDayRange` is cheap and unconditional, while `findAnchor` is
 * the one piece of this function whose cost scales with the size of the
 * yard's whole Occurrence history—there is no reason to walk that history
 * for a date the season fence would reject anyway.
 */
export function evaluateCadenceRule(
	rule: CadenceRule,
	plantId: string | null,
	occurrences: Occurrence[],
	asOf: string,
	timeZone: string,
): RuleVerdict {
	if (rule.season !== null && !isWithinMonthDayRange(asOf, rule.season.start, rule.season.end)) {
		return { fires: false };
	}

	const anchorRuleId = rule.after?.ruleId ?? rule.id;
	const anchor = findAnchor(anchorRuleId, plantId, occurrences);

	if (anchor === null) {
		if (rule.after !== null) {
			return { fires: false };
		}

		return {
			fires: true,
			status: 'fired',
			titleSuffix: 'never recorded',
			citation: { kind: 'cadence', lastOccurrenceId: null, elapsedDays: null },
		};
	}

	// `completedAt` is a UTC instant and `rule.everyDays` is written about local
	// days, so the anchor is converted to a local date before the subtraction—otherwise
	// a late-evening Occurrence would read as a day later than the
	// yard's own calendar shows.
	const elapsed = daysBetween(localDate(anchor.completedAt, timeZone), asOf);

	if (elapsed < rule.everyDays.min) {
		return { fires: false };
	}

	return {
		fires: true,
		status: 'fired',
		titleSuffix: elapsed > rule.everyDays.max ? 'overdue' : null,
		citation: { kind: 'cadence', lastOccurrenceId: anchor.id, elapsedDays: elapsed },
	};
}
