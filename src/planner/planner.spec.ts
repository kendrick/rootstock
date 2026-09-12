import type { PlanInput } from './planner';
import type { CadenceRule, GuardRule, ThresholdRule, WindowRule } from '@/rules/rule';
import type { Observation } from '@/weather/observation';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { cadenceRuleSchema, guardRuleSchema, ruleSchema, tagPolicySchema, thresholdRuleSchema, windowRuleSchema } from '@/rules/rule';
import { observationSchema } from '@/weather/observation';
import { plantSchema } from '@/yard/plant';
import { localDate } from './dates';
import { asOf, observations, occurrences, plants, rules, tagPolicy, timeZone } from './fixtures';
import { occurrenceSchema } from './occurrence';
import { dailyAggregateSchema, PLAN_WINDOW_DAYS, planSchema } from './plan';
import { plan, planInputSchema } from './planner';

/*
 * The fixtures are parsed where they are authored, so re-parsing them here
 * says nothing new about the parse. It holds the fixture file to the schemas
 * the rest of the system uses: later specs read these values as the real
 * thing, and the moment a fixture is patched with a cast to make a test go
 * green, this file fails.
 *
 * The coverage assertions below do the other half of the job. Each one names a
 * case the Planner has to handle and a tidy-up would delete without noticing.
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
	it('parse as plants', () => {
		expect(() => z.array(plantSchema).parse(plants)).not.toThrow();
	});

	it('parse as rules', () => {
		expect(() => z.array(ruleSchema).parse(rules)).not.toThrow();
	});

	it('parse as observations', () => {
		expect(() => z.array(observationSchema).parse(observations)).not.toThrow();
	});

	it('parse as occurrences', () => {
		expect(() => z.array(occurrenceSchema).parse(occurrences)).not.toThrow();
	});

	it('parse as a tag policy', () => {
		expect(() => tagPolicySchema.parse(tagPolicy)).not.toThrow();
	});

	it('hold a plant that is only planned', () => {
		expect(plants.some(plant => plant.status === 'planned')).toBe(true);
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
	it('accepts the assembled fixture input', () => {
		expect(() => planInputSchema.parse(planInput)).not.toThrow();
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

	// ADR 0001 rests on this: turning the model off has to leave the task list
	// unchanged, and that is only checkable if the Planner answers the same way
	// twice.
	it('answers the same way twice on the same input', () => {
		expect(plan(fixtureInput)).toEqual(plan(fixtureInput));
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

	it('leaves every task undeferred and unannotated, since no guard has run', () => {
		expect(fixturePlan.tasks.every(task => task.deferrals.length === 0)).toBe(true);
		expect(fixturePlan.tasks.every(task => task.annotations.length === 0)).toBe(true);
		expect(fixturePlan.tasks.every(task => task.status !== 'deferred')).toBe(true);
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
	 * The tag policy narrows delegability, and the Guard pass is the one place
	 * that narrowing happens. A Planner that also applied it here would agree
	 * with the Guard pass right up to the day the two read the policy
	 * differently, and the Away Card is the wrong place to discover that.
	 */
	it('copies delegable off the rule even when a never-delegable tag sits on it', () => {
		expect(tagPolicy.neverDelegableTags).toContain('chemical');

		const spray = windowRule({
			id: 'spray-the-beds',
			name: 'Spray the beds',
			tags: ['chemical'],
			delegable: true,
			productLabel: { url: 'https://example.com/labels/local.pdf' },
		});
		const tasks = plan(inputWith({ rules: [...rules, spray] })).tasks;

		expect(tasks.find(task => task.ruleId === 'spray-the-beds')?.delegable).toBe(true);
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
	// ship-everything end ADR 0003 weighs and turns down.
	it('holds only the series a threshold rule consults', () => {
		const consulted = fixturePlan.window.map(day => `${day.variable} ${day.depthCm} ${day.aggregate}`);
		expect([...new Set(consulted)]).toEqual(['soil-temperature 6 mean']);

		const forecastRain = observations.filter(observation => observation.variable === 'precipitation-probability');
		expect(forecastRain).not.toHaveLength(0);
	});

	// The trailing span bounds the history alone. An approaching Task cites a
	// projected date, and a window stopping at the as-of date could not draw it.
	it('carries the forecast days past the as-of date', () => {
		const forecast = fixturePlan.window.filter(day => day.basis === 'forecast');
		expect(forecast).not.toHaveLength(0);
		expect(forecast.every(day => day.date > asOf)).toBe(true);
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
	 * No Guard runs yet, and the window is sized for one anyway. Sizing it later
	 * would mean a Guard whose first real run happened to fall on a dry week
	 * passing its own tests and holding nothing, because the days it asked
	 * about were never carried.
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
