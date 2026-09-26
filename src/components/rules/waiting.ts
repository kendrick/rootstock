import type { DailyAggregate, Plan } from '@/planner/plan';
import type { Rule } from '@/rules/rule';
import { MONTHS } from '@/planner/dates';

/**
 * Which band a Rule sits in on the Rules route, ordered the way a reader asks
 * the question: what is happening now, what is about to, what is not yet, and
 * what never produces work at all.
 *
 * This replaces grouping by Rule kind. #69 built the route around the four
 * kinds and joined them to the current Plan, which made the taxonomy the
 * organising idea. A reader standing in the yard is asking what is next, and
 * the kind of Rule that answers them is an implementation fact they did not ask
 * about. The kinds are still shown, on every row, as a one-letter mark.
 */
export type Band = 'fired' | 'approaching' | 'waiting' | 'guard';

export interface RuleStanding {
	rule: Rule;
	band: Band;
	/** Whether the current Plan names this Rule: a Task for a Rule that creates work, a Deferral or Annotation for a Guard. */
	inCurrentPlan: boolean;
	/** What the Rule is waiting on, stated as fact and never as a forecast. */
	waitingOn: string;
	/** Days until a Window Rule opens. Sorts the waiting band; null where no honest number exists. */
	daysAway: number | null;
}

/**
 * Nothing here projects.
 *
 * `fired` and `approaching` are read off the Plan, so the Planner is the only
 * thing making a claim about what fired or is expected to. A Window Rule's
 * distance is calendar arithmetic on dates the Rule itself carries. A Threshold
 * Rule's line states the last observed reading beside the value the Rule wants,
 * which is two committed numbers side by side rather than a guess about when
 * they will meet. CONTEXT.md is strict that evidence which has happened is
 * never confused with evidence that is expected, and the cheapest way to honour
 * that here is to make no prediction of my own.
 */
function monthDayToDayOfYear(monthDay: string): number {
	const [month, day] = monthDay.split('-').map(Number);

	if (month === undefined || day === undefined) {
		return 0;
	}

	// A common year, deliberately. This orders a list; it is not a date anyone
	// acts on, and a leap day would shift every window by one for one year in
	// four to no reader's benefit.
	const priorMonthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31].slice(0, month - 1);

	return priorMonthLengths.reduce((total, length) => total + length, 0) + day;
}

function formatMonthDay(monthDay: string): string {
	const [month, day] = monthDay.split('-');
	const name = month === undefined ? undefined : MONTHS[Number(month) - 1];

	return name === undefined || day === undefined ? monthDay : `${name} ${Number(day)}`;
}

// One decimal, because the Artifact carries a daily mean at float precision
// (#59) and "88.79583333333335°F" reads as a machine dump beside a 55°F line.
function formatReading(value: number, unit: 'F' | 'mm' | 'percent'): string {
	const shown = Number(value.toFixed(1));

	if (unit === 'F') {
		return `${shown}°F`;
	}

	return unit === 'percent' ? `${shown}%` : `${shown}mm`;
}

function latestObserved(window: DailyAggregate[], rule: Extract<Rule, { kind: 'threshold' }>): DailyAggregate | null {
	const matching = window
		.filter(day =>
			day.variable === rule.variable
			&& day.depthCm === rule.depthCm
			&& day.aggregate === rule.aggregate
			&& day.basis === 'observed')
		.sort((left, right) => left.date.localeCompare(right.date));

	return matching.at(-1) ?? null;
}

/** Days from `asOf` until `start`, or 0 when `asOf` falls inside the span. Spans may wrap the year. */
function daysUntilOpen(asOf: string, start: string, end: string): number {
	const today = monthDayToDayOfYear(asOf.slice(5));
	const first = monthDayToDayOfYear(start);
	const last = monthDayToDayOfYear(end);
	const open = first <= last ? today >= first && today <= last : today >= first || today <= last;

	if (open) {
		return 0;
	}

	return first > today ? first - today : 365 - today + first;
}

function windowStanding(rule: Extract<Rule, { kind: 'window' }>, asOf: string): { waitingOn: string; daysAway: number | null } {
	const away = daysUntilOpen(asOf, rule.start, rule.end);

	return away === 0
		? { waitingOn: `Open through ${formatMonthDay(rule.end)}`, daysAway: 0 }
		: { waitingOn: `Opens ${formatMonthDay(rule.start)}`, daysAway: away };
}

/**
 * A fired Rule's status: the day its window or season closes. The band above
 * already says it fired, and the closing day is the one date the owner can act
 * against.
 */
function firedLine(rule: Exclude<Rule, { kind: 'guard' }>): string {
	if (rule.kind === 'window') {
		return `Window closes ${formatMonthDay(rule.end)}`;
	}

	if (rule.season !== null) {
		return `Season closes ${formatMonthDay(rule.season.end)}`;
	}

	return rule.kind === 'cadence'
		? `Next due ${intervalText(rule)} after it's recorded`
		: 'Fired on the latest reading';
}

function intervalText(rule: Extract<Rule, { kind: 'cadence' }>): string {
	const { min, max } = rule.everyDays;

	return min === max ? `${min} days` : `${min}–${max} days`;
}

export function standingFor(rule: Rule, plan: Plan): RuleStanding {
	const tasks = plan.tasks.filter(task => task.ruleId === rule.id);
	const fired = tasks.some(task => task.status === 'fired' || task.status === 'deferred');
	const approaching = tasks.some(task => task.status === 'approaching');

	if (rule.kind === 'guard') {
		// A Guard creates no work (CONTEXT.md), so it has nothing to be waiting for
		// and cannot be ranked beside Rules that do. It gets its own band, and what
		// it reports instead is whether it reached a Task on this Plan: a Guard that
		// deferred or annotated something acted, even though it authored nothing.
		const acted = plan.tasks.some(task =>
			task.deferrals.some(deferral => deferral.guardId === rule.id)
			|| task.annotations.some(annotation => annotation.guardId === rule.id));

		// ADR 0002's two effects get two verbs. An annotating Guard holds nothing
		// back, and saying it does would be the page inventing a Deferral.
		const verb = rule.effect === 'defer' ? 'Holding' : 'Marking';

		return {
			rule,
			band: 'guard',
			inCurrentPlan: acted,
			waitingOn: `${verb} ${acted ? 'work' : 'nothing'} this week`,
			daysAway: null,
		};
	}

	if (fired) {
		return { rule, band: 'fired', inCurrentPlan: true, waitingOn: firedLine(rule), daysAway: 0 };
	}

	if (approaching) {
		return { rule, band: 'approaching', inCurrentPlan: true, waitingOn: 'Forecast to be satisfied', daysAway: 0 };
	}

	if (rule.kind === 'window') {
		const { waitingOn, daysAway } = windowStanding(rule, plan.asOf);

		return { rule, band: 'waiting', inCurrentPlan: false, waitingOn, daysAway };
	}

	// Out of season a Rule can't fire whatever it reads, so its opening day is
	// the whole answer. A September reading beside a spring line reads as a
	// missed firing to anyone checking the Planner's work.
	const away = rule.season === null ? 0 : daysUntilOpen(plan.asOf, rule.season.start, rule.season.end);
	if (rule.season !== null && away > 0) {
		return { rule, band: 'waiting', inCurrentPlan: false, waitingOn: `Opens ${formatMonthDay(rule.season.start)}`, daysAway: away };
	}

	if (rule.kind === 'threshold') {
		const observed = latestObserved(plan.window, rule);
		const value = formatReading(rule.value, rule.unit);
		// A directed Rule fires on a Crossing (ADR 0005), so a reading already
		// past the value hasn't met it. The line names the Crossing, in the words
		// RuleSummary's "Fires when" row uses.
		const wants = rule.direction === null
			? `${rule.comparison === 'gte' ? 'at least' : 'at most'} ${value}`
			: `a ${rule.direction === 'rising' ? 'rise' : 'fall'} through ${value}`;

		return {
			rule,
			band: 'waiting',
			inCurrentPlan: false,
			waitingOn: observed === null
				// The Artifact carries the window the Rules were evaluated over (ADR
				// 0003), so a Rule with nothing in it was evaluated against readings
				// this page was not given rather than against nothing at all.
				? `No reading in the Artifact's window; needs ${wants}`
				: `Last read ${formatReading(observed.value, rule.unit)}; needs ${wants}`,
			daysAway: null,
		};
	}

	// A Cadence Rule carries a range rather than one interval, because the yard
	// does not need the work on an exact day and pretending otherwise would put a
	// false precision on the page.
	return {
		rule,
		band: 'waiting',
		inCurrentPlan: false,
		waitingOn: `Every ${intervalText(rule)}; not due this week`,
		daysAway: null,
	};
}

const BAND_ORDER: Record<Band, number> = { fired: 0, approaching: 1, waiting: 2, guard: 3 };

export function rankRules(rules: Rule[], plan: Plan): RuleStanding[] {
	return rules
		.map(rule => standingFor(rule, plan))
		.sort((left, right) => {
			if (BAND_ORDER[left.band] !== BAND_ORDER[right.band]) {
				return BAND_ORDER[left.band] - BAND_ORDER[right.band];
			}

			// Inside the waiting band, the Rule that opens soonest comes first. A Rule
			// with no honest number sorts after every Rule that has one rather than
			// being given a made-up distance to compete with.
			if (left.daysAway !== right.daysAway) {
				return (left.daysAway ?? Number.MAX_SAFE_INTEGER) - (right.daysAway ?? Number.MAX_SAFE_INTEGER);
			}

			return left.rule.name.localeCompare(right.rule.name);
		});
}
