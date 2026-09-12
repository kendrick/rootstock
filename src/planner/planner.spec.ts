import type { PlanInput } from './planner';
import type { Task } from './task';
import type { CadenceRule, GuardRule, Rule, ThresholdRule, WindowRule } from '@/rules/rule';
import type { Observation } from '@/weather/observation';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { cadenceRuleSchema, guardRuleSchema, thresholdRuleSchema, windowRuleSchema } from '@/rules/rule';
import { observationSchema } from '@/weather/observation';
import { localDate } from './dates';
import {
	asOf,
	delegableChemicalRule,
	guardScenarioRules,
	highPriorityRule,
	observations,
	occurrences,
	plants,
	rules,
	safetyGuard,
	tagPolicy,
	timeZone,
} from './fixtures';
import { FORECAST_UNAVAILABLE_TEXT } from './guards';
import { occurrenceSchema } from './occurrence';
import { dailyAggregateSchema, PLAN_WINDOW_DAYS, planSchema } from './plan';
import { plan, planInputSchema } from './planner';

/*
 * The assertions in the first block guard the fixture file rather than the
 * Planner. Each one names a case some later spec leans on being there — a
 * planned Plant, a window that wraps the year end, a Cadence Rule with no
 * history behind it — and a tidy-up would delete any of them without noticing
 * what went with it.
 *
 * The schema round-trip sits with `planInputSchema` below instead, because
 * that schema already composes all five of the ones a fixture is built from.
 */

const planInput = {
	asOf,
	timeZone,
	plants,
	rules,
	observations,
	occurrences,
	tagPolicy,
};

describe('the planner fixtures', () => {
	it('hold a plant that is only planned', () => {
		expect(plants.some(plant => plant.status === 'planned')).toBe(true);
	});

	/*
	 * `rain-expected` constrains on none of the three selectors, which is how a
	 * Guard says "every Task in the Plan". Half the specs below are shaped
	 * around it reaching that far, so a fixture edit that narrowed it would
	 * quietly turn several of them into assertions about nothing.
	 */
	it('hold a guard that reaches every task in the plan', () => {
		const yardWide = rules
			.filter(rule => rule.kind === 'guard')
			.filter(rule => rule.appliesTo.plantIds === null
				&& rule.appliesTo.plantTags === null
				&& rule.appliesTo.ruleTags === null);

		expect(yardWide.map(rule => rule.id)).toContain('rain-expected');
	});

	it('hold a window rule whose range crosses the year end', () => {
		const wrapping = rules.filter(rule => rule.kind === 'window').filter(rule => rule.end < rule.start);
		expect(wrapping).not.toHaveLength(0);
	});

	it('hold a cadence rule with occurrences behind it and one with none', () => {
		const cadences = rules.filter(rule => rule.kind === 'cadence');
		const withHistory = cadences.filter(rule => occurrences.some(occurrence => occurrence.ruleId === rule.id));
		expect(withHistory).not.toHaveLength(0);
		expect(withHistory.length).toBeLessThan(cadences.length);
	});

	it('hold only hourly observations, never a daily figure', () => {
		const perDay = new Map<string, number>();
		for (const observation of observations) {
			const day = observation.observedAt.slice(0, 10);
			perDay.set(day, (perDay.get(day) ?? 0) + 1);
		}
		expect([...perDay.values()].every(count => count > 1)).toBe(true);
	});

	// Compared as instants rather than by the date in the string. A Texas
	// evening on the as-of date is already tomorrow in UTC, which is why
	// `timeZone` is an input, and why a day-string comparison here would call
	// the fixture broken when it is right.
	it('run past the observed days on forecast', () => {
		const forecast = observations.filter(observation => observation.basis === 'forecast');
		const observed = observations.filter(observation => observation.basis === 'observed');
		expect(forecast).not.toHaveLength(0);

		const lastObserved = observed.map(observation => observation.observedAt).sort().at(-1) ?? '';
		expect(forecast.every(observation => observation.observedAt > lastObserved)).toBe(true);
	});

	it('hold a measured observation alongside the modeled ones for its day', () => {
		const measured = observations.filter(observation => observation.provenance === 'measured');
		expect(measured).not.toHaveLength(0);
		expect(measured.every(observation => observation.source === 'manual')).toBe(true);

		const measuredDays = new Set(measured.map(observation => observation.observedAt.slice(0, 10)));
		const modeledOnTheSameDay = observations.filter(
			observation => observation.provenance === 'modeled' && measuredDays.has(observation.observedAt.slice(0, 10)),
		);
		expect(modeledOnTheSameDay).not.toHaveLength(0);
	});
});

describe('planInputSchema', () => {
	/*
	 * Equality rather than `not.toThrow`, and it is the difference between a
	 * check and a decoration. `planInputSchema` composes the same Plant, Rule,
	 * Observation, Occurrence and TagPolicy schemas the fixture file already
	 * parses through, so a parse that merely succeeds here proves nothing that
	 * importing the file did not already prove. Comparing the result catches
	 * the two things that would slip past: a fixture patched with a cast to
	 * make some other test go green, and a fixture the schema quietly rewrites
	 * on the way through.
	 */
	it('accepts the assembled fixture input and returns it unchanged', () => {
		expect(planInputSchema.parse(planInput)).toEqual(planInput);
	});

	it('rejects a time zone that is not a zone name', () => {
		expect(() => planInputSchema.parse({ ...planInput, timeZone: 'Amerika/Chicago' })).toThrow();
	});

	it('rejects an unknown key', () => {
		expect(() => planInputSchema.parse({ ...planInput, weather: [] })).toThrow();
	});

	it('rejects a plan input missing its time zone', () => {
		const { timeZone: _dropped, ...withoutZone } = planInput;
		expect(() => planInputSchema.parse(withoutZone)).toThrow();
	});
});

/*
 * Every local Rule, Occurrence and Observation below goes through the same
 * schema the seed files go through. A literal annotated into place instead
 * would keep compiling against a shape the schemas had stopped accepting, and
 * the Planner would be tested against a yard nobody could author.
 */

const region = { name: 'Fort Worth', hardinessZone: '8b' };
const ownerSource = { kind: 'owner', label: 'House practice', url: null };

const ruleBase = {
	region,
	source: ownerSource,
	tags: [],
	delegable: true,
	priority: 50,
	appliesTo: { plantIds: null, plantTags: null, ruleTags: null },
	productLabel: null,
};

function windowRule(fields: Partial<WindowRule>): WindowRule {
	return windowRuleSchema.parse({
		...ruleBase,
		kind: 'window',
		id: 'local-window',
		name: 'Local window',
		start: '09-01',
		end: '09-30',
		...fields,
	});
}

function thresholdRule(fields: Partial<ThresholdRule>): ThresholdRule {
	return thresholdRuleSchema.parse({
		...ruleBase,
		kind: 'threshold',
		id: 'local-threshold',
		name: 'Local threshold',
		variable: 'soil-temperature',
		depthCm: 6,
		aggregate: 'mean',
		comparison: 'lte',
		value: 70,
		unit: 'F',
		consecutiveDays: 3,
		published: null,
		...fields,
	});
}

function cadenceRule(fields: Partial<CadenceRule>): CadenceRule {
	return cadenceRuleSchema.parse({
		...ruleBase,
		kind: 'cadence',
		id: 'local-cadence',
		name: 'Local cadence',
		everyDays: { min: 7, max: 14 },
		season: null,
		after: null,
		...fields,
	});
}

function guardRule(fields: Partial<GuardRule>): GuardRule {
	return guardRuleSchema.parse({
		...ruleBase,
		kind: 'guard',
		id: 'local-guard',
		name: 'Local guard',
		condition: { kind: 'always' },
		effect: 'defer',
		release: 'Nothing, this guard exists to be counted rather than run',
		...fields,
	});
}

function shiftDate(date: string, days: number): string {
	const shifted = new Date(`${date}T00:00:00Z`);
	shifted.setUTCDate(shifted.getUTCDate() + days);
	return shifted.toISOString().slice(0, 10);
}

/*
 * Soil readings older than the fixture's own thirty days, warm enough that
 * they can never satisfy the Rule that reads them. They exist only to be
 * counted: with them on hand, the oldest date in `Plan.window` reports how far
 * back the Planner decided to reach, and the widening tests below have
 * something to observe. Noon UTC lands on the same local date in Central
 * time, so the day each one belongs to is the day it is written for.
 */
const olderSoil: Observation[] = Array.from({ length: 15 }, (_unused, index) => observationSchema.parse({
	observedAt: `${shiftDate(asOf, -(PLAN_WINDOW_DAYS + index))}T12:00:00Z`,
	variable: 'soil-temperature',
	depthCm: 6,
	value: 80,
	unit: 'F',
	basis: 'observed',
	provenance: 'modeled',
	source: 'open-meteo',
	station: null,
}));

function inputWith(overrides: Partial<PlanInput>): PlanInput {
	return planInputSchema.parse({ ...planInput, ...overrides });
}

const fixtureInput = inputWith({});
const fixturePlan = plan(fixtureInput);

function oldestWindowDate(input: PlanInput): string {
	return plan(input).window.map(day => day.date).sort().at(0) ?? '';
}

/*
 * `rain-expected` is met on the fixture morning—the forecast carries a 70% day
 * two days out—and it reaches every Task, so a Plan built from the whole
 * fixture set comes back entirely deferred. That is the Guard working, and
 * it is also a blanket over everything underneath it. A spec about a
 * projection, a title or a span plans without that one Guard rather than
 * asserting less than it means to.
 *
 * Dropped by name, and it throws when the name stops matching, because a
 * filter that silently removed nothing would leave the spec passing against a
 * Plan it was written to avoid.
 */
function withoutRule(id: string, set: Rule[]): Rule[] {
	const kept = set.filter(rule => rule.id !== id);
	if (kept.length === set.length) {
		throw new Error(`planner fixtures no longer carry the Rule '${id}' this spec drops`);
	}
	return kept;
}

/** Reads a deferring fixture Guard's own sentence, so a reworded fixture fails here by name instead of by string diff. */
function releaseOf(id: string): string {
	const guard = guardScenarioRules.find(rule => rule.id === id);
	if (guard === undefined || guard.kind !== 'guard' || guard.effect !== 'defer') {
		throw new Error(`planner fixtures no longer carry a deferring Guard '${id}'`);
	}
	return guard.release;
}

/*
 * Deferrals land in the order the Rule set put the Guards in, which is the one
 * thing about a Plan that reordering the input legitimately changes: two
 * Guards that both hold a Task are both recorded on it either way. Sorting
 * them is what lets the reordering spec compare everything else strictly.
 */
function withSortedDeferrals(tasks: Task[]): Task[] {
	return tasks.map(task => ({
		...task,
		deferrals: [...task.deferrals].sort((left, right) => left.guardId < right.guardId ? -1 : 1),
	}));
}

describe('plan', () => {
	it('authors one task per plant a fired rule reached, and nothing else', () => {
		expect(fixturePlan.tasks.map(task => task.id)).toEqual([
			'fall-pre-emergent@front-lawn',
			'fall-pre-emergent-soil@front-lawn',
			'esperanza-feeding@esperanza-1',
		]);
	});

	it('returns a plan that parses through planSchema', () => {
		expect(() => planSchema.parse(fixturePlan)).not.toThrow();
	});

	it('cites only rules it was given', () => {
		const known = new Set(rules.map(rule => rule.id));
		expect(fixturePlan.tasks.every(task => known.has(task.ruleId))).toBe(true);
	});

	it('dates the plan for the day it was asked about', () => {
		expect(fixturePlan.asOf).toBe(asOf);
	});

	/*
	 * ADR 0001 rests on this: turning the model off has to leave the task list
	 * unchanged, and that is only checkable if the Planner answers the same way
	 * twice.
	 *
	 * Comparing two calls alone would be a check that cannot fail, since a
	 * function with no clock and no randomness repeats itself by construction.
	 * What can actually go wrong is the Planner writing through one of its own
	 * arguments — sorting `rules` in place would do it — and that shows up on
	 * the second call or on whoever holds the array next. So the input is
	 * compared against a copy taken before the first call, which is the half
	 * of purity a repeat test cannot see.
	 */
	it('answers the same way twice and leaves its input untouched', () => {
		const before = structuredClone(fixtureInput);

		const first = plan(fixtureInput);
		const second = plan(fixtureInput);

		expect(first).toEqual(second);
		expect(fixtureInput).toEqual(before);
	});

	/*
	 * The stronger half of the same claim. Nothing upstream promises the order
	 * a seed file's rules or observations arrive in, so an answer that depended
	 * on it would drift the day somebody sorted a JSON file, and the diff would
	 * look like the yard changed.
	 *
	 * The readings move a local day at a time rather than one by one, and the
	 * limit that forces it is worth naming. A daily mean adds its readings in
	 * the order they arrive, floating-point addition is not associative, and
	 * 77.2 summed back to front comes out 77.19999999999999. So the guarantee
	 * the Planner can make is that the day a reading belongs to decides the
	 * answer, never where in the array it sat.
	 */
	it('answers the same way whatever order its inputs arrive in', () => {
		const byLocalDay = new Map<string, Observation[]>();
		for (const observation of observations) {
			const day = localDate(observation.observedAt, timeZone);
			byLocalDay.set(day, [...byLocalDay.get(day) ?? [], observation]);
		}

		const reordered = inputWith({
			plants: [...plants].reverse(),
			rules: [...rules].reverse(),
			observations: [...byLocalDay.values()].reverse().flat(),
			occurrences: [...occurrences].reverse(),
		});

		expect(plan(reordered)).toEqual(fixturePlan);
	});

	/*
	 * A deferral and an annotation are things a Guard puts on a Task, and a
	 * Rule set holding no Guard is the case where nothing should put one there.
	 * The Planner has no other path to either field, and this is what says so:
	 * a `status` computed from something other than the Guard pass would show
	 * up here as a deferral nobody authored.
	 */
	it('leaves every task undeferred and unannotated when the rule set holds no guard', () => {
		const unguarded = plan(inputWith({ rules: rules.filter(rule => rule.kind !== 'guard') }));

		expect(unguarded.tasks).not.toHaveLength(0);
		expect(unguarded.tasks.every(task => task.deferrals.length === 0)).toBe(true);
		expect(unguarded.tasks.every(task => task.annotations.length === 0)).toBe(true);
		expect(unguarded.tasks.every(task => task.status !== 'deferred')).toBe(true);
	});

	it('owes no work to a plant that is only planned', () => {
		const mulch = windowRule({
			id: 'mulch-the-fruit',
			name: 'Mulch the fruit trees',
			appliesTo: { plantIds: null, plantTags: ['fruit'], ruleTags: null },
		});
		const tasks = plan(inputWith({ rules: [...rules, mulch] })).tasks;

		expect(tasks.map(task => task.id)).toContain('mulch-the-fruit@fig-1');
		expect(tasks.every(task => task.plantId !== 'pomegranate-1')).toBe(true);
	});

	it('gives a whole-yard rule one task with no plant on it', () => {
		const sweep = windowRule({ id: 'yard-sweep', name: 'Sweep the yard' });
		const tasks = plan(inputWith({ rules: [...rules, sweep] })).tasks;
		const swept = tasks.filter(task => task.ruleId === 'yard-sweep');

		expect(swept).toHaveLength(1);
		expect(swept.at(0)?.plantId).toBeNull();
		expect(swept.at(0)?.id).toBe('yard-sweep');
		expect(swept.at(0)?.title).toBe('Sweep the yard');
	});

	it('names the plant in the title of a task targeting one', () => {
		expect(fixturePlan.tasks.find(task => task.id === 'fall-pre-emergent@front-lawn')?.title)
			.toBe('Fall pre-emergent on the front lawn (Front lawn)');
	});

	it('appends a cadence rule\'s suffix to the title it wrote', () => {
		const feeding = cadenceRule({
			id: 'patio-feeding',
			name: 'Feed the patio pots',
			appliesTo: { plantIds: ['esperanza-1'], plantTags: null, ruleTags: null },
		});
		const fed = occurrenceSchema.parse({
			id: 'patio-feeding-2026-08-02',
			ruleId: 'patio-feeding',
			plantId: 'esperanza-1',
			completedAt: '2026-08-02T14:20:00Z',
			recordedAt: '2026-08-02T14:22:00Z',
			source: 'seed',
		});

		const overdue = plan(inputWith({ rules: [...rules, feeding], occurrences: [...occurrences, fed] })).tasks;
		expect(overdue.find(task => task.ruleId === 'patio-feeding')?.title)
			.toBe('Feed the patio pots (Esperanza), overdue');

		const neverDone = plan(inputWith({ rules: [...rules, feeding] })).tasks;
		expect(neverDone.find(task => task.ruleId === 'patio-feeding')?.title)
			.toBe('Feed the patio pots (Esperanza), never recorded');
	});

	/*
	 * Both Rules below author themselves delegable, so whatever separates their
	 * Tasks came from the tag policy rather than from the Rule. `chemical` is
	 * on `neverDelegableTags` and `pruning` is on neither list, which is the
	 * pair that proves the policy narrows the one it names and leaves the other
	 * where its author put it.
	 */
	it('narrows delegability through the tag policy, and leaves an untagged rule where its author put it', () => {
		expect(tagPolicy.neverDelegableTags).toContain('chemical');
		expect(delegableChemicalRule.delegable).toBe(true);
		expect(highPriorityRule.delegable).toBe(true);

		const tasks = plan(inputWith({ rules: guardScenarioRules })).tasks;

		expect(tasks.find(task => task.ruleId === delegableChemicalRule.id)?.delegable).toBe(false);
		expect(tasks.find(task => task.ruleId === highPriorityRule.id)?.delegable).toBe(true);
	});

	/*
	 * The approaching branch end to end. Every other proof of it stops at the
	 * verdict, so nothing until now showed that `plan()` carries a projection
	 * onto the Task it authors: wiring that dropped the status or handed back a
	 * fired Citation would have passed the whole suite.
	 *
	 * The Rule asks for a run the observed days never reach. The fixture's soil
	 * series bottoms out at 66.8F on the as-of date and keeps falling through
	 * the forecast tail, so both days at or below 65.5F are forecast and the
	 * crossing is expected rather than recorded.
	 *
	 * Planned without the yard-wide rain Guard, which would hold this Task and
	 * overwrite the very status the spec is here to read.
	 */
	it('carries a threshold projection onto the task it authors', () => {
		const overseed = thresholdRule({
			id: 'overseed-when-cool',
			name: 'Overseed once the soil settles below 65.5F',
			value: 65.5,
			consecutiveDays: 2,
			appliesTo: { plantIds: ['front-lawn'], plantTags: null, ruleTags: null },
		});

		const tasks = plan(inputWith({ rules: [...withoutRule('rain-expected', rules), overseed] })).tasks;

		expect(tasks.find(task => task.ruleId === 'overseed-when-cool')).toMatchObject({
			id: 'overseed-when-cool@front-lawn',
			plantId: 'front-lawn',
			status: 'approaching',
			citation: {
				kind: 'threshold-projection',
				variable: 'soil-temperature',
				depthCm: 6,
				aggregate: 'mean',
				projectedDate: '2026-09-14',
			},
			title: 'Overseed once the soil settles below 65.5F (Front lawn)',
		});
	});
});

/*
 * The Guard pass seen from outside, through the one function the rest of the
 * system calls. Each assertion here is about something only `plan()` can get
 * wrong: which Tasks reach the pass, what comes back paired with what, and
 * which fields survive the round trip.
 */
describe('plan under guards', () => {
	const guardScenario = inputWith({ rules: guardScenarioRules });
	const guardScenarioPlan = plan(guardScenario);

	/*
	 * ADR 0002 in one assertion, and the reason it is a whole-object equality
	 * rather than a status check: a deferred Task that lost its Citation, its
	 * Rule or its title on the way through the pass is exactly the silence the
	 * ADR rules out, and every one of those losses would pass a spec that only
	 * read `status`.
	 *
	 * Two Guards hold this Task—the yard-wide rain Guard and the fig's own—and
	 * both are recorded. A pass that stopped at the first would still produce a
	 * deferred Task, and the interface would offer a release condition that
	 * only half the yard agreed with.
	 */
	it('keeps a deferred task in the plan, carrying its rule, its citation and every guard that held it', () => {
		expect(guardScenarioPlan.tasks.find(task => task.id === 'fig-fertilizer@fig-1')).toEqual({
			id: 'fig-fertilizer@fig-1',
			ruleId: 'fig-fertilizer',
			plantId: 'fig-1',
			status: 'deferred',
			citation: { kind: 'cadence', lastOccurrenceId: null, elapsedDays: null },
			deferrals: [
				{ guardId: 'rain-expected', releaseWhen: releaseOf('rain-expected') },
				{ guardId: 'fig-fertilizer-until-spring', releaseWhen: releaseOf('fig-fertilizer-until-spring') },
			],
			annotations: [],
			delegable: true,
			tags: ['fertilizer'],
			title: 'Feed the fig (Celeste fig), never recorded',
		});
	});

	/*
	 * The case the whole pass is built around, end to end. The Rule set holds a
	 * `no-rain-within` Guard and the Observations hold no rain at all, so the
	 * series the Guard needs is genuinely absent rather than merely clear.
	 *
	 * Releasing the work is correct: holding it back on evidence nobody has is
	 * the other way to be wrong, and ADR 0002 gives a Guard no way to stay
	 * silent about either. So the Task goes ahead and says on its face that
	 * nobody checked. Assert the deferral is empty as well as the status,
	 * because a Task carrying a deferral it does not act on would satisfy a
	 * status check while telling the interface two different stories.
	 */
	it('releases work and annotates it when the forecast a guard needs was never collected', () => {
		const unforecast = inputWith({
			observations: observations.filter(observation => observation.variable !== 'precipitation-probability'),
		});
		const unforecastPlan = plan(unforecast);
		const held = unforecastPlan.tasks.find(task => task.ruleId === 'fall-pre-emergent');

		expect(unforecastPlan.window.some(day => day.variable === 'precipitation-probability')).toBe(false);
		expect(held?.status).not.toBe('deferred');
		expect(held?.deferrals).toEqual([]);
		expect(held?.annotations).toContainEqual({ guardId: 'rain-expected', text: FORECAST_UNAVAILABLE_TEXT });
	});

	/*
	 * The Guard pass copies every Task it is handed, and a copy is where a pure
	 * function usually stops being one. Comparing against a clone taken before
	 * the first call is what would catch a pass that wrote back through an
	 * argument; comparing two calls alone could not.
	 */
	it('answers the same way twice and leaves its input untouched with every guard in play', () => {
		const before = structuredClone(guardScenario);

		const first = plan(guardScenario);
		const second = plan(guardScenario);

		expect(first).toEqual(second);
		expect(guardScenario).toEqual(before);
	});

	/*
	 * Nothing upstream promises the order Guards arrive in, and a Guard's reach
	 * is resolved against the Tasks as they were authored, so the order can
	 * change exactly one thing: which of two Guards holding the same Task is
	 * recorded on it first. Everything else has to match, ids and ordering
	 * included.
	 */
	it('answers the same way whatever order the guards arrive in, bar a task\'s own deferral order', () => {
		expect(guardScenarioPlan.tasks.some(task => task.deferrals.length > 1)).toBe(true);

		const reordered = plan(inputWith({ rules: [...guardScenarioRules].reverse() }));

		expect(withSortedDeferrals(reordered.tasks)).toEqual(withSortedDeferrals(guardScenarioPlan.tasks));
		expect(reordered.window).toEqual(guardScenarioPlan.window);
	});

	// `taskSchema` requires the status and the deferrals to agree, and
	// `planSchema` requires the ids to stay unique, which is the pairing the
	// pass would break by returning Tasks the ordering then matched by position.
	it('returns a plan that still parses through planSchema once the guards have run', () => {
		expect(() => planSchema.parse(guardScenarioPlan)).not.toThrow();
	});

	/*
	 * `applyGuards` proves in isolation that it never reads `priority`. What
	 * only `plan()` can show is that nothing downstream quietly undoes that:
	 * the Rule with the lowest priority number in the fixture set sorts near
	 * the front of the Plan and is deferred where it sits.
	 *
	 * Both halves are the assertion. A Task that lost its deferral on the way
	 * through the ordering would fail the first; a Plan that answered by
	 * demoting held work to the bottom would fail the second, and would be a
	 * Deferred Task the household reads as finished rather than held. Ranking
	 * and holding are separate questions about a Task and the Plan answers
	 * them separately.
	 */
	it('defers the rule that asked to go first without moving it down the plan', () => {
		const ranked = guardScenarioPlan.tasks.findIndex(task => task.ruleId === highPriorityRule.id);
		const held = guardScenarioPlan.tasks[ranked];

		expect(held?.status).toBe('deferred');
		expect(held?.deferrals.map(deferral => deferral.guardId)).toContain(safetyGuard.id);
		expect(ranked).toBeLessThan(guardScenarioPlan.tasks.length - 1);

		const undeferred = plan(inputWith({ rules: withoutRule(safetyGuard.id, withoutRule('rain-expected', guardScenarioRules)) }));
		const unheld = undeferred.tasks.findIndex(task => task.ruleId === highPriorityRule.id);

		expect(undeferred.tasks[unheld]?.status).not.toBe('deferred');
		expect(unheld).toBe(ranked);
	});
});

describe('plan window', () => {
	it('carries the days the threshold rules read', () => {
		expect(fixturePlan.window).not.toHaveLength(0);
	});

	it('parses every day through dailyAggregateSchema', () => {
		expect(() => z.array(dailyAggregateSchema).parse(fixturePlan.window)).not.toThrow();
	});

	// Reducing every variable the weather layer happened to fetch would put
	// readings no Rule consults in the published Artifact. That is the
	// ship-everything end ADR 0003 weighs and turns down. Two series are
	// consulted here and each is asked for by a different kind of Rule: the
	// soil run by the Threshold Rules, the rain by the Guard.
	it('holds only the series the rules consult, at the reduction each asked for', () => {
		const consulted = fixturePlan.window.map(day => `${day.variable} ${day.depthCm} ${day.aggregate}`);

		expect([...new Set(consulted)].sort()).toEqual([
			'precipitation-probability null max',
			'soil-temperature 6 mean',
		]);
	});

	/*
	 * `evaluateGuardCondition` reads daily maxima and will not take a mean, so
	 * collecting the wrong reduction is the same as collecting nothing, except
	 * that the window looks full while the Guard goes unanswered.
	 */
	it('carries the rain a no-rain-within guard reads, as a daily maximum', () => {
		const rain = fixturePlan.window.filter(day => day.variable === 'precipitation-probability');

		expect(rain).not.toHaveLength(0);
		expect(rain.every(day => day.aggregate === 'max' && day.depthCm === null)).toBe(true);
		expect(rain.every(day => day.basis === 'forecast')).toBe(true);
	});

	// The other half of the same claim, and the one that keeps the window a
	// budget rather than a dump: these days are here because a Guard asked,
	// not because the weather layer fetched them.
	it('carries no rain at all when no guard asks about it', () => {
		expect(observations.some(observation => observation.variable === 'precipitation-probability')).toBe(true);

		const window = plan(inputWith({ rules: withoutRule('rain-expected', rules) })).window;

		expect(window).not.toHaveLength(0);
		expect(window.some(day => day.variable === 'precipitation-probability')).toBe(false);
	});

	// The trailing span bounds the history alone. An approaching Task cites a
	// projected date, and a window stopping at the as-of date could not draw it.
	it('carries the forecast days past the as-of date', () => {
		const forecast = fixturePlan.window.filter(day => day.basis === 'forecast');
		expect(forecast).not.toHaveLength(0);
		expect(forecast.every(day => day.date > asOf)).toBe(true);
	});

	/*
	 * A forecast row for a day already gone is left over from an earlier fetch.
	 * No Rule reads one, and ADR 0003 makes the window the readings the Rules
	 * looked at, so carrying one would draw a point on the published sparkline
	 * that nothing in the Plan can account for.
	 *
	 * One forecast hour is enough to make its whole local day forecast, which
	 * is what puts the day three days back on the wrong side of the boundary.
	 */
	it('leaves a stale forecast day out of the window', () => {
		const stale = observationSchema.parse({
			observedAt: `${shiftDate(asOf, -3)}T12:00:00Z`,
			variable: 'soil-temperature',
			depthCm: 6,
			value: 61,
			unit: 'F',
			basis: 'forecast',
			provenance: 'modeled',
			source: 'open-meteo',
			station: null,
		});

		const window = plan(inputWith({ observations: [...observations, stale] })).window;

		expect(window.some(day => day.basis === 'forecast' && day.date < asOf)).toBe(false);
	});

	it('reaches back the standard span when no rule asks for more', () => {
		expect(oldestWindowDate(inputWith({ observations: [...observations, ...olderSoil] })))
			.toBe(shiftDate(asOf, -(PLAN_WINDOW_DAYS - 1)));
	});

	// ADR 0003 fixes the direction of the repair: a Rule reaching further back
	// widens the window, and shortening the Rule to fit is the move it rules out.
	it('widens for a threshold rule whose run is longer than the standard span', () => {
		const longRun = thresholdRule({ id: 'long-run', name: 'Long run', consecutiveDays: PLAN_WINDOW_DAYS + 10 });

		expect(oldestWindowDate(inputWith({
			rules: [...rules, longRun],
			observations: [...observations, ...olderSoil],
		}))).toBe(shiftDate(asOf, -(PLAN_WINDOW_DAYS + 9)));
	});

	/*
	 * A Guard's horizon widens the span the same way a Threshold Rule's run
	 * does. Sizing the window under it would mean a Guard whose week happened
	 * to be dry passing its own tests and holding nothing, because the days it
	 * asked about were never carried.
	 */
	it('widens for a guard asking about more days than the standard span', () => {
		const patient = guardRule({
			id: 'long-dry-spell',
			name: 'Hold until a long dry spell',
			condition: { kind: 'no-rain-within', days: PLAN_WINDOW_DAYS + 10, probabilityAtLeast: 50 },
		});

		expect(oldestWindowDate(inputWith({
			rules: [...rules, patient],
			observations: [...observations, ...olderSoil],
		}))).toBe(shiftDate(asOf, -(PLAN_WINDOW_DAYS + 9)));
	});

	it('is empty when no rule reads a series at all', () => {
		const calendarOnly = windowRule({ id: 'calendar-only', name: 'Calendar only' });

		expect(plan(inputWith({ rules: [calendarOnly] })).window).toEqual([]);
	});
});
