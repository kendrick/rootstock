import type { DailyAggregate } from './plan';
import type { GuardCondition } from '@/rules/rule';
import { daysBetween, isWithinMonthDayRange } from './dates';

/**
 * What one Guard's condition concluded on the planned date. The third value is
 * why this is not a boolean.
 *
 * A Guard applies its effect when its condition is met, so 'unmet' is a claim
 * about the evidence rather than a gap in it: the Planner looked, and the yard
 * is clear. That claim lets work go ahead. `rain-expected` exists to hold watering
 * and spraying back ahead of a storm, and an 'unmet' it never earned puts
 * pre-emergent down the afternoon before two inches of rain carry it into the
 * street.
 *
 * 'unavailable' covers every way the evidence can fail to show up—the series
 * was never collected, the forecast does not reach the day, the rows on hand
 * are the wrong reduction. A boolean makes all of those look like a clear sky.
 * What the Guard pass does with the third value is ADR 0002's business: it has
 * a Task it may annotate and no path to let one through quietly. It cannot make
 * that choice unless this function hands it the difference.
 */
export type GuardVerdict = 'met' | 'unmet' | 'unavailable';

type RainCondition = Extract<GuardCondition, { kind: 'no-rain-within' }>;

/**
 * The days of forecast rain chance a `no-rain-within` Guard is entitled to
 * read, which is a narrower set than every precipitation row the window
 * happens to carry.
 *
 * `aggregate` is matched rather than assumed. A day's mean chance of rain and
 * its daily maximum are different numbers off the same hours: a front that
 * sits over the yard for four hours of an otherwise dry day reads 70 as a max
 * and something near 15 as a mean. Taking a mean row for the maximum
 * understates the storm, and understating the storm is how the Guard lets
 * through work it was written to hold.
 *
 * `basis` is matched for the reverse reason. A forecast is the only thing
 * that can say anything about a day that has not happened, and the horizon is
 * made almost entirely of such days. That cuts both ways, which is why the
 * horizon is bounded behind `asOf` as well as ahead of it: a forecast row
 * dated before the planned date is left over from an earlier fetch, and
 * letting one vote would settle today's Guard on a storm that already came and
 * went.
 */
function rainChanceDays(
	condition: RainCondition,
	window: DailyAggregate[],
	asOf: string,
): DailyAggregate[] {
	return window.filter((day) => {
		if (day.variable !== 'precipitation-probability' || day.depthCm !== null) {
			return false;
		}

		if (day.aggregate !== 'max' || day.basis !== 'forecast') {
			return false;
		}

		const ahead = daysBetween(asOf, day.date);
		return ahead >= 0 && ahead <= condition.days;
	});
}

/**
 * Decides whether one Guard's condition holds on the planned date, reading
 * nothing but its arguments.
 *
 * `no-rain-within` is met when rain is expected. The name reads backwards
 * until you remember that a Guard applies its effect when its condition is
 * met, and that this one exists to hold work back before a storm. The fixture
 * Guard carries the sentence that fires on 'met'—"No day above a 50% chance of
 * rain in the next two days"—and that sentence is a release condition, which
 * is what ADR 0002 says every deferral owes the interface. So the name says
 * what would release the Task.
 *
 * An empty horizon is 'unavailable', and the rest of this function is built
 * around that case. `buildWindow` in planner.ts collects series from Threshold
 * Rules alone, so today a `no-rain-within` Guard is handed a window with no
 * precipitation in it at all. Answering 'unmet' there would be a lie the Plan
 * has no way to show: the Guard finds no rain, lets the watering go ahead, and the
 * published artifact looks exactly like a morning the forecast really was
 * clear. The verdict stays 'unavailable' after the collection widens, too,
 * because the forecast can still run out before the Guard's horizon does, and
 * nothing downstream should have to guess which of the two happened.
 *
 * `always` and `within-window` never reach for the window and so can never
 * come back 'unavailable'. A house rule and a calendar range are both settled
 * by the date alone.
 *
 * The switch has no default branch, so a fourth condition kind added to
 * `guardConditionSchema` fails here at compile time rather than falling
 * through to some verdict nobody chose for it. `verdictFor` in planner.ts
 * refuses a default for the same reason, and the cost of getting it wrong is
 * worse here: an unhandled Rule kind authors no work, while an unhandled Guard
 * condition lets through work that should have been held.
 */
export function evaluateGuardCondition(
	condition: GuardCondition,
	window: DailyAggregate[],
	asOf: string,
): GuardVerdict {
	switch (condition.kind) {
		case 'always':
			return 'met';

		case 'within-window': {
			/*
			 * `negate` flips which side of the range counts, so the two
			 * booleans differing is what "met" means: inside an un-negated
			 * range, or outside a negated one. `end` sorting before `start` is
			 * a range that wraps the year rather than a malformed Rule, and
			 * `isWithinMonthDayRange` already carries that.
			 */
			const inside = isWithinMonthDayRange(asOf, condition.start, condition.end);
			return inside !== condition.negate ? 'met' : 'unmet';
		}

		case 'no-rain-within': {
			const days = rainChanceDays(condition, window, asOf);
			if (days.length === 0) {
				return 'unavailable';
			}

			return days.some(day => day.value >= condition.probabilityAtLeast) ? 'met' : 'unmet';
		}
	}
}
