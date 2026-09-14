import type { OrderableTask } from './order';
import type { DailyAggregate, Plan } from './plan';
import type { Citation, Task } from './task';
import type { CadenceRule, GuardCondition, Rule, TagPolicy, ThresholdRule, WindowRule } from '@/rules/rule';
import type { Aggregate, Variable } from '@/weather/observation';
import type { Plant } from '@/yard/plant';
import { z } from 'zod';
import { ruleSchema, tagPolicySchema, thresholdLookbackDays } from '@/rules/rule';
import { observationSchema } from '@/weather/observation';
import { plantSchema } from '@/yard/plant';
import { toDailyAggregates } from './aggregate';
import { evaluateCadenceRule } from './cadence-rule';
import { daysBetween } from './dates';
import { isDelegable } from './delegation';
import { applyGuards } from './guards';
import { occurrenceSchema } from './occurrence';
import { orderTasks } from './order';
import { PLAN_WINDOW_DAYS } from './plan';
import { targets } from './targets';
import { taskId } from './task';
import { evaluateThresholdRule } from './threshold-rule';
import { evaluateWindowRule } from './window-rule';

/**
 * An IANA zone name, checked by handing it to `Intl` instead of matching a
 * pattern. `America/Chicago` and `Amerika/Chicago` are the same shape, and the
 * typo would bucket every Observation into the wrong day while reading fine in
 * a seed file.
 */
const timeZoneSchema = z.string().refine(
	(value) => {
		try {
			return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone.length > 0;
		}
		catch {
			return false;
		}
	},
	{ message: 'must be an IANA time zone name, such as \'America/Chicago\'' },
);

/**
 * Everything the Planner is given for one date. It reads no clock and makes no
 * network call, so the date it plans for arrives here as an argument alongside
 * the yard it plans over, which is what lets a spec plan any day of any year
 * without moving the machine's calendar.
 *
 * `timeZone` is here because `observations` carry UTC instants and Rules are
 * written about local days. Without the zone there is no local day to bucket
 * an hourly Observation into, and a September evening in Texas lands on
 * tomorrow's date if the Planner guesses UTC.
 *
 * `observations` are hourly. The Planner owns the reduction to a daily figure
 * because the choice between a mean, a min and a sum belongs to the Rule
 * reading it, and nothing upstream knows which Rule that will be.
 *
 * This is a parser rather than a type alias because it runs against a
 * generation run's real inputs, where the seed files are hand-authored JSON.
 * The composed schemas do the work: a Rule is validated here by the same
 * schema that validates it anywhere else, so this file cannot drift into a
 * second opinion about what a Rule is.
 */
export const planInputSchema = z.strictObject({
	asOf: z.iso.date(),
	timeZone: timeZoneSchema,
	plants: z.array(plantSchema),
	rules: z.array(ruleSchema),
	observations: z.array(observationSchema),
	occurrences: z.array(occurrenceSchema),
	tagPolicy: tagPolicySchema,
});

/**
 * Inferred off the parser rather than written out beside it, because the two
 * would describe different objects. Half the hand-authored fields carry
 * `.default(null)`—a Rule's `productLabel`, an `appliesTo` selector, an
 * Occurrence's `plantId`—so the JSON somebody types and the object the Planner
 * reads are already different shapes. An interface written by hand here would
 * describe whichever of the two its author had in mind that day, and every
 * caller of `plan()` would then be coding against that guess.
 */
export type PlanInput = z.infer<typeof planInputSchema>;

/**
 * What one Rule concluded about one Plant on the planned date.
 *
 * A Rule module returns this rather than a Task because ADR 0001 gives the
 * Planner sole authority to author one: a Task carries an id derived from the
 * pair it belongs to, a delegability already narrowed by tag policy, and a
 * title in the house voice, and none of those are facts a Rule knows on its
 * own. So each module answers the one question it can answer—did this fire, on
 * what evidence—and the Planner turns that answer into work.
 *
 * The split also keeps the Guard pass honest. A Guard runs over Tasks after
 * they exist, and a Rule module that had already produced a finished Task
 * would leave nothing for the Planner to hold back.
 *
 * `titleSuffix` carries the mechanical clause a Cadence Rule appends to a
 * title—'overdue', 'never recorded'—and is null for the Rule kinds that have
 * nothing to add. The Planner writes the title and the model writes the
 * sentences, so the suffix is the one fragment a Rule contributes to the
 * mechanical wording.
 */
export type RuleVerdict
	= | { fires: false }
		| {
			fires: true;
			status: 'fired' | 'approaching';
			citation: Citation;
			titleSuffix: string | null;
		};

/** The three kinds that author work. A Guard is the fourth and creates none, so it never reaches the functions below. */
type TaskCreatingRule = WindowRule | ThresholdRule | CadenceRule;

/**
 * How far back the Plan carries history, which is `PLAN_WINDOW_DAYS` until a
 * Rule asks for more. ADR 0003 fixes that direction of travel: a Rule reaching
 * past the constant widens the window, and shortening the Rule to fit the days
 * on hand is the repair the ADR rules out.
 *
 * The Guard arm is worth reading twice, because the two runs of days it
 * compares do not point the same way. `consecutiveDays` reaches backwards and
 * this span bounds history, so a Threshold Rule widening it is the ADR's case
 * exactly. `no-rain-within` reaches forwards, and `buildWindow` bounds the
 * forecast by what was fetched rather than by this number, so widening the
 * history on a Guard's horizon buys that Guard nothing. At the days the yard
 * actually uses it changes nothing either: the rain Guard looks two days out
 * against a thirty-day floor. It is left here because trimming a Rule's stated
 * lookback is the repair ADR 0003 rules out, and no Rule has yet asked for a
 * number that makes the difference visible.
 */
/**
 * Narrows a Rule to the one Guard shape that reads weather, so the two places
 * that care about it ask the same question rather than each spelling out the
 * pair of checks. A Guard on any other condition is settled by the date alone
 * and asks the window for nothing.
 */
function rainForecastGuard(rule: Rule): Extract<GuardCondition, { kind: 'no-rain-within' }> | null {
	return rule.kind === 'guard' && rule.condition.kind === 'no-rain-within' ? rule.condition : null;
}

function windowSpan(rules: Rule[]): number {
	let days = PLAN_WINDOW_DAYS;

	for (const rule of rules) {
		const rain = rainForecastGuard(rule);
		if (rule.kind === 'threshold') {
			days = Math.max(days, thresholdLookbackDays(rule));
		}
		else if (rain !== null) {
			days = Math.max(days, rain.days);
		}
	}

	return days;
}

/**
 * A series identity as a comparable string, the same trick as `groupKey` in
 * aggregate.ts and for the same reason: `depthCm` is nullable, so the natural
 * key is not a primitive, and a null depth has to stay its own series rather
 * than collapsing into a surface reading.
 */
function seriesKey(variable: Variable, depthCm: number | null): string {
	return `${variable} ${depthCm === null ? 'null' : depthCm}`;
}

/**
 * Which series each reduction has to be run for, grouped by the reduction
 * rather than listed one triple at a time. Two Rules reading soil temperature
 * as a mean share a single pass over the hourly Observations; fanning out per
 * triple would re-reduce the same thirty days once per Rule, and the yard's
 * Rule set grows faster than its variable list does.
 *
 * A Threshold Rule names its own series. A `no-rain-within` Guard does not, so
 * the one it reads is added on its behalf: chance of rain, at no depth,
 * reduced to a daily maximum. `evaluateGuardCondition` refuses a mean row, so
 * collecting the mean would hand the Guard a series it may not read, which
 * lands on the same verdict as collecting nothing at all and is harder to spot
 * from a window that looks full.
 */
function seriesByAggregate(rules: Rule[]): Map<Aggregate, Set<string>> {
	const wanted = new Map<Aggregate, Set<string>>();

	function want(aggregate: Aggregate, key: string): void {
		const keys = wanted.get(aggregate) ?? new Set<string>();
		keys.add(key);
		wanted.set(aggregate, keys);
	}

	for (const rule of rules) {
		if (rule.kind === 'threshold') {
			want(rule.aggregate, seriesKey(rule.variable, rule.depthCm));
		}
		else if (rainForecastGuard(rule) !== null) {
			want('max', seriesKey('precipitation-probability', null));
		}
	}

	return wanted;
}

function compareDepth(left: number | null, right: number | null): number {
	if (left === right) {
		return 0;
	}
	if (left === null) {
		return 1;
	}
	if (right === null) {
		return -1;
	}
	return left - right;
}

/**
 * The DailyAggregates the Rules actually read—the runs a Threshold Rule
 * measures, and the rain a Guard checks for—which is what ADR 0003 says
 * travels with the Plan. Only the series some Rule consults are carried:
 * reducing every variable the weather layer happened to fetch would put soil
 * moisture nobody reads in the published file, and the window is a budget
 * somebody spends deliberately.
 *
 * The trailing span bounds the history alone. Every forecast day on hand is
 * carried however far out it sits, because a Threshold Rule's `approaching`
 * verdict is drawn from exactly those days, as is everything a
 * `no-rain-within` Guard has to go on, and a Citation naming a projected date
 * past the window's end is one the interface cannot draw.
 *
 * The assembled array gets its own sort even though `toDailyAggregates`
 * returns each call already sorted. The days arrive one reduction at a time,
 * so concatenating them leaves the reductions sitting in blocks rather than in
 * date order, and the order a Plan's window lands in shows up as a diff in the
 * committed Artifact every time somebody reorders the Rule set.
 */
function buildWindow(input: PlanInput, span: number): DailyAggregate[] {
	const window: DailyAggregate[] = [];

	for (const [aggregate, keys] of seriesByAggregate(input.rules)) {
		for (const day of toDailyAggregates(input.observations, input.timeZone, aggregate)) {
			if (!keys.has(seriesKey(day.variable, day.depthCm))) {
				continue;
			}

			/*
			 * Bounded from both sides, and matching what a Threshold Rule
			 * actually reads, because ADR 0003 makes the window the readings
			 * the Rules looked at rather than everything on hand. Observed
			 * history reaches back `span` days; forecast runs forward from
			 * `asOf`. A forecast row dated before `asOf` is left over from an
			 * earlier fetch, and carrying one would put a point on the
			 * published sparkline that no Rule ever read.
			 */
			const trailing = daysBetween(day.date, input.asOf);
			const keep = day.basis === 'forecast'
				? trailing <= 0
				: trailing >= 0 && trailing < span;
			if (keep) {
				window.push(day);
			}
		}
	}

	window.sort((left, right) => {
		if (left.date !== right.date) {
			return left.date < right.date ? -1 : 1;
		}
		if (left.variable !== right.variable) {
			return left.variable < right.variable ? -1 : 1;
		}
		if (left.depthCm !== right.depthCm) {
			return compareDepth(left.depthCm, right.depthCm);
		}
		return left.aggregate < right.aggregate ? -1 : left.aggregate > right.aggregate ? 1 : 0;
	});

	return window;
}

/**
 * Hands one Rule to the module that knows how to read it.
 *
 * A Window Rule and a Threshold Rule reach the same verdict for every Plant
 * they target, because neither one looks at the Plant. `plantId` reaches only
 * the Cadence Rule, which counts from Occurrences keyed by the pair. The
 * repeated evaluation is deliberate: the Rule still owes one Task per Plant it
 * named, and each Task is marked done on its own, so mulching three fruit trees
 * is three Tasks however identical the reasoning behind them was.
 *
 * The switch has no default branch, so a fifth Rule kind added to the schema
 * fails here at compile time. The alternative is a Rule kind that authors
 * nothing and says so nowhere, which reads from outside exactly like a yard
 * with nothing to do.
 */
function verdictFor(
	rule: TaskCreatingRule,
	plantId: string | null,
	input: PlanInput,
	window: DailyAggregate[],
): RuleVerdict {
	switch (rule.kind) {
		case 'window':
			return evaluateWindowRule(rule, input.asOf);
		case 'threshold':
			return evaluateThresholdRule(rule, window, input.asOf);
		case 'cadence':
			return evaluateCadenceRule(rule, plantId, input.occurrences, input.asOf, input.timeZone);
	}
}

/**
 * The mechanical sentence every Task carries. ADR 0001 makes this a real
 * deliverable rather than a placeholder the model will improve on: Narration
 * is optional by construction, the Away Card falls back to this line, and the
 * household reads that card without knowing which version they were handed.
 *
 * The Plant's name goes in parentheses instead of being worked into the
 * sentence because a Rule's `name` is authored once and reused across every
 * Plant it reaches. Any smoother phrasing would need the Rule author to write
 * a sentence with a hole in it, and that is a worse thing to get wrong than a
 * parenthesis is to read.
 */
function titleFor(rule: TaskCreatingRule, plant: Plant | null, titleSuffix: string | null): string {
	const subject = plant === null ? rule.name : `${rule.name} (${plant.name})`;

	return titleSuffix === null ? subject : `${subject}, ${titleSuffix}`;
}

/**
 * Turns every Rule that fired into the Task it authored, paired with the two
 * facts the ordering needs and a Task does not carry.
 *
 * This is a named function and not a stretch of `plan()` because the Guard
 * pass runs at exactly this seam: Guards run over finished Tasks, per ADR
 * 0002, so there has to be a moment where the Tasks exist and nothing has
 * ranked them yet.
 *
 * `delegable` is copied off the Rule verbatim and narrowed afterwards, by
 * `plan()`, against the TagPolicy's `neverDelegableTags`. One site applies the
 * policy because the policy can only ever narrow: a second site would agree
 * with the first through every test written today and diverge the day the two
 * read the tag list differently. The Away Card is where that divergence would
 * surface, and it is the wrong place to discover it.
 */
function createTasks(input: PlanInput, window: DailyAggregate[]): OrderableTask[] {
	const orderables: OrderableTask[] = [];

	for (const rule of input.rules) {
		// A Guard creates no work. It reaches the Plan by holding a Task back or
		// marking one up, and neither is possible before the Tasks exist.
		if (rule.kind === 'guard') {
			continue;
		}

		const scope = targets(rule, input.plants);
		const pairs: Array<{ plantId: string | null; plant: Plant | null }>
			= scope.plants === null
				? [{ plantId: null, plant: null }]
				: scope.plants.map(plant => ({ plantId: plant.id, plant }));

		for (const { plantId, plant } of pairs) {
			const verdict = verdictFor(rule, plantId, input, window);
			if (!verdict.fires) {
				continue;
			}

			const task: Task = {
				id: taskId(rule.id, plantId),
				ruleId: rule.id,
				plantId,
				status: verdict.status,
				citation: verdict.citation,
				deferrals: [],
				annotations: [],
				delegable: rule.delegable,
				tags: rule.tags,
				title: titleFor(rule, plant, verdict.titleSuffix),
			};

			orderables.push({ task, specificity: scope.specificity, priority: rule.priority });
		}
	}

	return orderables;
}

/**
 * Settles what a Task's `delegable` finally says, once for each Task and in
 * one place.
 *
 * The Rule is looked up by `ruleId` rather than carried down from
 * `createTasks`, so the field the Away Card reads is computed from the Rule
 * set the Plan was built out of rather than from something the authoring pass
 * remembered on its way past. A Task citing a Rule nobody handed in means the
 * Plan is already broken, so it throws instead of publishing a guess about who
 * is allowed to do the work.
 */
function stampDelegability(tasks: Task[], rules: Rule[], tagPolicy: TagPolicy): Task[] {
	return tasks.map((task) => {
		const rule = rules.find(candidate => candidate.id === task.ruleId);
		if (rule === undefined) {
			throw new Error(`task '${task.id}' cites the rule '${task.ruleId}', which is not in the rule set the plan was built from`);
		}

		return { ...task, delegable: isDelegable(rule, tagPolicy) };
	});
}

/**
 * Puts each guarded Task back beside the specificity and priority its original
 * arrived with, which `applyGuards` neither takes nor returns.
 *
 * Paired by id, never by position. `planSchema` refines Task ids unique within
 * a Plan, so an id is a real key. An index is a standing bet that the Guard
 * pass hands its Tasks back in the order it was given them, and the day that
 * bet stops paying, a Task is ranked by another Task's priority and nothing in
 * the Plan says so. A missing id throws for the same reason, rather than
 * letting a `Map.get` miss become an `undefined` somewhere inside the Plan.
 */
function pairForOrdering(orderables: OrderableTask[], tasks: Task[]): OrderableTask[] {
	const byId = new Map(tasks.map(task => [task.id, task]));

	return orderables.map((entry) => {
		const task = byId.get(entry.task.id);
		if (task === undefined) {
			throw new Error(`the guard pass returned no task for '${entry.task.id}'`);
		}

		return { ...entry, task };
	});
}

/**
 * Turns one day's inputs into the Plan for that date.
 *
 * Everything here is derived from the arguments. There is no clock read, no
 * fetch and no model call, because ADR 0001 rests the whole product on this
 * function being re-runnable: turning the model off has to leave the Task list
 * byte-identical, and that claim is only checkable if the same inputs give the
 * same Plan tomorrow. `input.asOf` is the only notion of today anything in
 * this package has.
 *
 * The window is built before the Tasks rather than alongside them, because a
 * Threshold Rule reads days it did not choose. Sizing the span off the whole
 * Rule set first is what lets one Rule asking for a forty-day run widen the
 * history every other Rule then reads, instead of each Rule getting whatever
 * days its own lookback happened to reach.
 *
 * The Guard pass sits between the authoring and the ordering, for reasons
 * `applyGuards` sets out rather than repeats here. What that placement costs
 * is local and visible: ordering needs a Rule's specificity and priority, a
 * Task carries neither, and `applyGuards` has no use for either, so the Tasks
 * come apart from their ranking facts and go back together around the pass.
 *
 * Delegability is stamped here, after the Guards and before the sort, and
 * nowhere else. The tag policy narrows what a Rule already claimed, and a
 * narrowing applied in two places is one that can eventually disagree with
 * itself about which tags count. `isDelegable` owns the direction it reads in.
 *
 * Nothing here calls `planSchema.parse`. This repo validates at its
 * boundaries—`parseWith` in src/validation/parse.ts, at the generation run
 * that writes the Artifact—and a function re-parsing what it just built would
 * pay a boundary's price in the middle of the system. The specs prove the
 * returned Plan parses; the Planner does not pay for that proof on every call.
 */
export function plan(input: PlanInput): Plan {
	const window = buildWindow(input, windowSpan(input.rules));
	const orderables = createTasks(input, window);

	const authored = orderables.map(entry => entry.task);
	const guarded = applyGuards(authored, input.rules, input.plants, window, input.asOf);
	const tasks = stampDelegability(guarded, input.rules, input.tagPolicy);

	return {
		asOf: input.asOf,
		tasks: orderTasks(pairForOrdering(orderables, tasks), input.tagPolicy),
		window,
	};
}
