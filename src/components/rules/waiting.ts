import type { GuardVerdict } from '@/planner/guard-conditions';
import type { DailyAggregate, Plan } from '@/planner/plan';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import { roundKeepingSide } from '@/planner/aggregate';
import { MONTHS } from '@/planner/dates';
import { FORECAST_UNAVAILABLE_TEXT } from '@/planner/guards';

/**
 * Which band a Rule sits in on the Rules route, ordered the way a reader asks
 * the question: what is happening now, what is about to, what is not yet, and
 * what never produces work at all.
 *
 * This replaces grouping by Rule kind. #69 built the route around the four
 * kinds and joined them to the current Plan, which made the taxonomy the
 * organising idea. A reader standing in the yard is asking what is next, and
 * the kind of Rule that answers them is an implementation fact they did not ask
 * about. Each row still prints its kind, in words, among its marks.
 */
export type Band = 'fired' | 'approaching' | 'waiting' | 'guard';

export interface RuleStanding {
	rule: Rule;
	band: Band;
	/** Whether the current Plan names this Rule: a Task for a Rule that creates work, a Deferral or Annotation for a Guard. */
	inCurrentPlan: boolean;
	/** What the Rule is waiting on, stated as fact and never as a forecast. */
	waitingOn: string;
	/** For a Guard, each Task it reached on this Plan and what its condition concluded there. Empty for every other Rule. */
	checks: CheckedTask[];
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

// One decimal where that leaves a reading on its side of `lines`, because an
// Artifact committed before #59 carries a daily mean at float precision and
// "88.79583333333335°F" reads as a machine dump beside a 55°F line.
function formatReading(value: number, unit: 'F' | 'mm' | 'percent', lines: readonly number[] = []): string {
	const shown = roundKeepingSide(value, lines);

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
function firedLine(rule: Exclude<Rule, { kind: 'guard' }>, task: Task | undefined): string {
	if (rule.kind === 'window') {
		return `Window closes ${formatMonthDay(rule.end)}`;
	}

	if (rule.season !== null) {
		return `Season closes ${formatMonthDay(rule.season.end)}`;
	}

	if (rule.kind === 'cadence') {
		return `Next due ${intervalText(rule)} after it's recorded`;
	}

	// The earliest qualifying run fires the Rule, and later readings may have
	// crossed back, so the line names the run the Task cites.
	return task?.citation.kind === 'threshold'
		? `Fired on the run from ${formatMonthDay(task.citation.from.slice(5))} to ${formatMonthDay(task.citation.to.slice(5))}`
		: 'Fired this week';
}

/** One Task a Guard reached, its verdict there, and what the Guard left on it. */
export interface CheckedTask {
	title: string;
	verdict: GuardVerdict;
	/** The group label, from what the Guard actually left on the Task. */
	label: CheckLabel;
	/** The Deferral's release condition, as the Planner copied it onto the Task. */
	releaseWhen: string | null;
}

/** Deferred or annotated first, then work the Guard couldn't check, then work it let through. */
export const CHECK_LABELS = ['Deferring:', 'Annotating:', 'Let through unchecked:', 'Let through:'] as const;
export type CheckLabel = typeof CHECK_LABELS[number];

/** A Guard's Tasks under each label it has any for, in `CHECK_LABELS` order. */
export function groupChecks(checks: readonly CheckedTask[]): { label: CheckLabel; titles: string[] }[] {
	return CHECK_LABELS
		.map(label => ({ label, titles: checks.filter(check => check.label === label).map(check => check.title) }))
		.filter(group => group.titles.length > 0);
}

/**
 * What a Guard concluded on each Task it reached, read off the Plan.
 *
 * The Guard pass records every verdict in `Task.guardChecks`, so this reads
 * the record and never re-derives the reach: today's Rules and Plants may not
 * be the ones that produced the Plan. For the same reason a `met` Task is
 * labelled by the Deferral or Annotation it carries, never by the Guard's
 * current `effect`, and the release condition comes off the Deferral.
 *
 * A Task from an Artifact written before that record existed carries
 * `guardChecks: null`. There only the verdicts that leave a mark can be read,
 * and an `unmet` verdict leaves nothing, so such a Task is left out rather
 * than called clear.
 */
function checksFor(rule: Extract<Rule, { kind: 'guard' }>, plan: Plan): CheckedTask[] {
	return plan.tasks.flatMap((task): CheckedTask[] => {
		const deferral = task.deferrals.find(candidate => candidate.guardId === rule.id);
		const annotation = task.annotations.find(candidate => candidate.guardId === rule.id);
		const unchecked = annotation?.text === FORECAST_UNAVAILABLE_TEXT;
		const marked = (label: CheckLabel, verdict: GuardVerdict): CheckedTask[] =>
			[{ title: task.title, verdict, label, releaseWhen: deferral?.releaseWhen ?? null }];

		const recorded = task.guardChecks === null
			? undefined
			: task.guardChecks.find(candidate => candidate.guardId === rule.id)?.verdict ?? null;
		if (recorded === null) {
			return [];
		}
		if (deferral !== undefined) {
			return marked('Deferring:', 'met');
		}
		if (annotation !== undefined) {
			return unchecked ? marked('Let through unchecked:', 'unavailable') : marked('Annotating:', 'met');
		}

		return recorded === 'unmet' ? marked('Let through:', 'unmet') : [];
	});
}

function listOf(items: string[]): string {
	return items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

export function intervalText(rule: Extract<Rule, { kind: 'cadence' }>): string {
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
		const checks = checksFor(rule, plan);
		const recorded = plan.tasks.every(task => task.guardChecks !== null);
		const done = checks.filter(check => check.verdict === 'met').map(check => check.title);

		return {
			rule,
			band: 'guard',
			inCurrentPlan: done.length > 0,
			waitingOn: checks.length === 0
				// Without a record, "reached nothing" can't be told from "let
				// everything through", so the line claims only what the Plan shows.
				? recorded ? 'Reaches no Task this week' : `${rule.effect === 'defer' ? 'Deferring' : 'Annotating'} nothing this week`
				: groupChecks(checks).map(({ label, titles }) => `${label} ${listOf(titles)}`).join('; '),
			checks,
			daysAway: null,
		};
	}

	if (fired) {
		const firedTask = tasks.find(task => task.status === 'fired' || task.status === 'deferred');
		return { rule, band: 'fired', inCurrentPlan: true, waitingOn: firedLine(rule, firedTask), checks: [], daysAway: 0 };
	}

	if (approaching) {
		return { rule, band: 'approaching', inCurrentPlan: true, waitingOn: 'Forecast to be satisfied', checks: [], daysAway: 0 };
	}

	if (rule.kind === 'window') {
		const { waitingOn, daysAway } = windowStanding(rule, plan.asOf);

		return { rule, band: 'waiting', inCurrentPlan: false, waitingOn, checks: [], daysAway };
	}

	// Out of season a Rule can't fire whatever it reads, so its opening day is
	// the whole answer. A September reading beside a spring line reads as a
	// missed firing to anyone checking the Planner's work.
	const away = rule.season === null ? 0 : daysUntilOpen(plan.asOf, rule.season.start, rule.season.end);
	if (rule.season !== null && away > 0) {
		return { rule, band: 'waiting', inCurrentPlan: false, waitingOn: `Opens ${formatMonthDay(rule.season.start)}`, checks: [], daysAway: away };
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
				: `Last read ${formatReading(observed.value, rule.unit, [rule.value])}; needs ${wants}`,
			checks: [],
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
		// The Plan is evaluated for one day, so a Rule with no Task is known not
		// due on that day only. It may fire tomorrow. A follow-up counts from the
		// Rule it follows rather than every so many days, so "Every" would be
		// wrong for it; the row names that Rule on a line of its own.
		waitingOn: rule.after === null
			? `Every ${intervalText(rule)}; not due as of ${formatMonthDay(plan.asOf.slice(5))}`
			: `Not due as of ${formatMonthDay(plan.asOf.slice(5))}`,
		checks: [],
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
