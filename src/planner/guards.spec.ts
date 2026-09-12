import type { DailyAggregate } from './plan';
import type { Task } from './task';
import type { GuardRule, Rule } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { ruleSchema } from '@/rules/rule';
import { toDailyAggregates } from './aggregate';
import {
	asOf,
	figFertilizerGuard,
	figFertilizerRule,
	guardScenarioRules,
	highPriorityRule,
	observations,
	plants,
	rules,
	safetyGuard,
	timeZone,
} from './fixtures';
import { applyGuards, FORECAST_UNAVAILABLE_TEXT } from './guards';
import { taskId, taskSchema } from './task';

/*
 * The Tasks below are hand-authored rather than taken from `plan()`, because a
 * later wave wires `plan()` to this function. Reading its output here would
 * make half these assertions circular the day that lands: the Tasks would
 * arrive already guarded, and a spec asserting that `applyGuards` deferred
 * something would be watching itself run twice.
 *
 * They are still real Tasks. Each one is parsed through `taskSchema`, carries
 * the Citation its Rule kind produces, and copies `delegable` and `tags` off
 * the committed fixture Rule. A Rule re-authored with different tags therefore
 * breaks the Task built from it, instead of moving a Guard's reach here and
 * saying nothing.
 */

const region = { name: 'Fort Worth', hardinessZone: '8b' };
const ownerSource = { kind: 'owner', label: 'House practice', url: null };

/** Narrowed by id against the committed set, so a renamed fixture fails here by name. */
function fixtureRule(id: string): Rule {
	const found = guardScenarioRules.find(candidate => candidate.id === id);
	if (found === undefined) {
		throw new Error(`planner fixtures no longer carry the Rule '${id}' this spec is built on`);
	}
	return found;
}

/** Narrows a fixture Rule to the Guard this file reads its id and its sentence off. */
function asGuard(rule: Rule): GuardRule {
	if (rule.kind !== 'guard') {
		throw new Error(`planner fixture '${rule.id}' is no longer a Guard`);
	}
	return rule;
}

/** Both readers throw rather than defaulting, so a fixture re-authored with the other effect fails by name here. */
function releaseOf(guard: GuardRule): string {
	if (guard.effect !== 'defer') {
		throw new Error(`planner fixture '${guard.id}' no longer defers, so it carries no release`);
	}
	return guard.release;
}

function textOf(guard: GuardRule): string {
	if (guard.effect !== 'annotate') {
		throw new Error(`planner fixture '${guard.id}' no longer annotates, so it carries no text`);
	}
	return guard.text;
}

function taskFor(ruleId: string, plantId: string | null, fields: Partial<Task> = {}): Task {
	const rule = fixtureRule(ruleId);

	return taskSchema.parse({
		id: taskId(ruleId, plantId),
		ruleId,
		plantId,
		status: 'fired',
		citation: { kind: 'window', date: asOf },
		deferrals: [],
		annotations: [],
		delegable: rule.delegable,
		tags: rule.tags,
		title: rule.name,
		...fields,
	});
}

/** Fails loudly rather than returning `undefined` under `noUncheckedIndexedAccess`. */
function only(tasks: Task[]): Task {
	const [task] = tasks;
	if (task === undefined || tasks.length !== 1) {
		throw new Error(`expected one Task back from applyGuards, got ${tasks.length}`);
	}
	return task;
}

/** Doubles as the no-Task-was-dropped check every lookup in this file makes. */
function byId(tasks: Task[], id: string): Task {
	const found = tasks.find(task => task.id === id);
	if (found === undefined) {
		throw new Error(`applyGuards did not return a Task for '${id}'`);
	}
	return found;
}

const rainGuard = asGuard(fixtureRule('rain-expected'));
const waterInGuard = asGuard(fixtureRule('water-in-after-application'));
const springGuard = asGuard(figFertilizerGuard);
const ladderGuard = asGuard(safetyGuard);

/**
 * A `no-rain-within` Guard that annotates instead of deferring. The fixtures
 * carry no such pairing, and the branch under test needs one. An annotate
 * Guard holds nothing back, so a version of `applyGuards` that treated
 * 'unavailable' as "release what you were about to defer" would have nothing
 * to do here and would pass on every fixture Guard. It still owes the reader
 * the sentence saying nobody checked.
 */
const forecastNoteGuard: Rule = ruleSchema.parse({
	id: 'rain-note',
	name: 'Say what the rain chance is before watering',
	kind: 'guard',
	region,
	source: ownerSource,
	tags: ['watering'],
	delegable: false,
	priority: 93,
	appliesTo: { plantIds: null, plantTags: null, ruleTags: null },
	productLabel: null,
	condition: { kind: 'no-rain-within', days: 2, probabilityAtLeast: 50 },
	effect: 'annotate',
	text: 'Rain is coming, so leave the hose alone.',
});

const fallPreEmergent = taskFor('fall-pre-emergent', 'front-lawn');
const fallPreEmergentSoil = taskFor('fall-pre-emergent-soil', 'front-lawn', {
	citation: {
		kind: 'threshold',
		variable: 'soil-temperature',
		depthCm: 6,
		aggregate: 'mean',
		from: '2026-09-09',
		to: '2026-09-11',
	},
});
const esperanzaFeeding = taskFor('esperanza-feeding', 'esperanza-1', {
	citation: { kind: 'cadence', lastOccurrenceId: 'esperanza-feeding-2026-08-02', elapsedDays: 40 },
});
const figFertilizer = taskFor('fig-fertilizer', 'fig-1', {
	citation: { kind: 'cadence', lastOccurrenceId: null, elapsedDays: null },
});
const fungicide = taskFor('fungicide-preventive', 'front-lawn');
const figPrune = taskFor('fig-prune-first', 'fig-1');

/** Every fixture Rule that fires on the fixture `asOf`, which is the Plan a Guard pass really runs over. */
const scenarioTasks = [
	fallPreEmergent,
	fallPreEmergentSoil,
	esperanzaFeeding,
	figFertilizer,
	fungicide,
	figPrune,
];

/**
 * The fixture's own forecast, reduced the way a `no-rain-within` Guard reads
 * it. `rain-expected` asks for a daily maximum, so the reduction is `max`
 * rather than the `mean` the Threshold Rules want, and the fixture's front two
 * days out is what carries the Guard past its 50% threshold.
 */
const rainyWindow = toDailyAggregates(observations, timeZone, 'max');

/**
 * What `buildWindow` hands a Guard today: soil temperature and nothing else,
 * because it collects series from Threshold Rules alone. The forecast here is
 * absent rather than clear, and telling those two apart is why
 * `evaluateGuardCondition` has a third verdict at all.
 */
const forecastlessWindow: DailyAggregate[] = toDailyAggregates(observations, timeZone, 'mean')
	.filter(day => day.variable === 'soil-temperature');

describe('applyGuards', () => {
	describe('the Plan it hands back', () => {
		it('returns one Task per Task it was given, in the order it was given them', () => {
			const guarded = applyGuards(scenarioTasks, guardScenarioRules, plants, rainyWindow, asOf);

			expect(guarded).toHaveLength(scenarioTasks.length);
			expect(guarded.map(task => task.id)).toEqual(scenarioTasks.map(task => task.id));
		});

		it('returns a different object for every Task, deferred or not', () => {
			const guarded = applyGuards(scenarioTasks, guardScenarioRules, plants, rainyWindow, asOf);

			expect(guarded.every((task, index) => task !== scenarioTasks[index])).toBe(true);
		});

		it('hands back no array the input Task still holds', () => {
			// A returned Task pointing at the input's own `deferrals` is a Plan
			// the caller can write into by appending to what it was handed back,
			// and a Task no Guard reached is where that slips through.
			const guarded = applyGuards(scenarioTasks, guardScenarioRules, plants, rainyWindow, asOf);

			for (const original of scenarioTasks) {
				const task = byId(guarded, original.id);

				expect(task.deferrals).not.toBe(original.deferrals);
				expect(task.annotations).not.toBe(original.annotations);
			}
		});

		it('leaves every input Task exactly as it found it', () => {
			// The copy is deep because the shortcut it rules out is shallow: a
			// spread of the Task shares its `deferrals` array with the original,
			// so appending to one writes through, and every other assertion in
			// this file still passes.
			const before = structuredClone(scenarioTasks);

			applyGuards(scenarioTasks, guardScenarioRules, plants, rainyWindow, asOf);

			expect(scenarioTasks).toEqual(before);
		});

		it('returns Tasks that parse through taskSchema', () => {
			// This is what proves the status refine held: a Task carrying a
			// deferral while still calling itself 'fired' fails here.
			const guarded = applyGuards(scenarioTasks, guardScenarioRules, plants, rainyWindow, asOf);

			for (const task of guarded) {
				expect(() => taskSchema.parse(task)).not.toThrow();
			}
		});

		it('changes nothing about a Task no Guard reaches', () => {
			// `fig-fertilizer-until-spring` names the fig and the `fertilizer`
			// Rule tag, and the fig's pruning satisfies only the first half.
			const guarded = applyGuards([figPrune], [highPriorityRule, figFertilizerRule, figFertilizerGuard], plants, [], asOf);

			expect(guarded).toEqual([figPrune]);
			expect(only(guarded)).not.toBe(figPrune);
		});
	});

	describe('deferring', () => {
		it('records the Guard that held the work and what would release it', () => {
			const guarded = only(applyGuards([figFertilizer], [figFertilizerRule, figFertilizerGuard], plants, [], asOf));

			expect(guarded.status).toBe('deferred');
			expect(guarded.deferrals).toEqual([
				{ guardId: springGuard.id, releaseWhen: releaseOf(springGuard) },
			]);
		});

		it('keeps the deferred Task whole', () => {
			// ADR 0002 turns on exactly this: a held Task stays on screen
			// carrying the Rule and the evidence that produced it, or the
			// interface cannot tell it apart from work nobody ever wrote a
			// Rule for.
			const guarded = only(applyGuards([figFertilizer], [figFertilizerRule, figFertilizerGuard], plants, [], asOf));

			expect(guarded.ruleId).toBe(figFertilizer.ruleId);
			expect(guarded.plantId).toBe(figFertilizer.plantId);
			expect(guarded.citation).toEqual(figFertilizer.citation);
			expect(guarded.title).toBe(figFertilizer.title);
		});

		it('does not defer the fig feeding on a date inside the spring window', () => {
			const guarded = only(applyGuards([figFertilizer], [figFertilizerRule, figFertilizerGuard], plants, [], '2026-04-15'));

			expect(guarded.status).toBe('fired');
			expect(guarded.deferrals).toEqual([]);
			expect(guarded.annotations).toEqual([]);
		});

		it('defers a chemical Task when the forecast carries rain inside the horizon', () => {
			const guarded = only(applyGuards([fallPreEmergent], rules, plants, rainyWindow, asOf));

			expect(guarded.tags).toContain('chemical');
			expect(guarded.status).toBe('deferred');
			expect(guarded.deferrals).toContainEqual({ guardId: rainGuard.id, releaseWhen: releaseOf(rainGuard) });
		});

		it('defers a Rule that asked to go first', () => {
			// `fig-prune-first` carries the lowest priority in the fixture set,
			// so a short-circuit letting an urgent Rule outrun a Guard shows up
			// here.
			const others = guardScenarioRules
				.filter(rule => rule.id !== highPriorityRule.id)
				.map(rule => rule.priority);
			expect(highPriorityRule.priority).toBeLessThan(Math.min(...others));

			const guarded = only(applyGuards([figPrune], [highPriorityRule, safetyGuard], plants, [], asOf));

			expect(guarded.status).toBe('deferred');
			expect(guarded.deferrals).toEqual([
				{ guardId: ladderGuard.id, releaseWhen: releaseOf(ladderGuard) },
			]);
		});
	});

	describe('annotating', () => {
		it('attaches the Guard\'s own text and leaves the status alone', () => {
			const guarded = only(applyGuards([fallPreEmergent], [fixtureRule('fall-pre-emergent'), waterInGuard], plants, [], asOf));

			expect(guarded.status).toBe('fired');
			expect(guarded.deferrals).toEqual([]);
			expect(guarded.annotations).toEqual([
				{ guardId: waterInGuard.id, text: textOf(waterInGuard) },
			]);
		});
	});

	describe('an unavailable forecast', () => {
		it('releases the work a defer Guard would have held, and says so', () => {
			const guarded = only(applyGuards([fallPreEmergent], [fixtureRule('fall-pre-emergent'), rainGuard], plants, forecastlessWindow, asOf));

			expect(guarded.status).toBe('fired');
			expect(guarded.deferrals).toEqual([]);
			expect(guarded.annotations).toEqual([
				{ guardId: rainGuard.id, text: FORECAST_UNAVAILABLE_TEXT },
			]);
		});

		it('says the same thing through an annotate Guard, in place of its own text', () => {
			const guarded = only(applyGuards([fallPreEmergent], [fixtureRule('fall-pre-emergent'), forecastNoteGuard], plants, forecastlessWindow, asOf));

			expect(guarded.status).toBe('fired');
			expect(guarded.deferrals).toEqual([]);
			expect(guarded.annotations).toEqual([
				{ guardId: forecastNoteGuard.id, text: FORECAST_UNAVAILABLE_TEXT },
			]);
		});

		it('leaves an approaching Task approaching', () => {
			const approaching = taskFor('fall-pre-emergent-soil', 'front-lawn', {
				status: 'approaching',
				citation: {
					kind: 'threshold-projection',
					variable: 'soil-temperature',
					depthCm: 6,
					aggregate: 'mean',
					projectedDate: '2026-09-14',
				},
			});

			const guarded = only(applyGuards([approaching], [fixtureRule('fall-pre-emergent-soil'), rainGuard], plants, forecastlessWindow, asOf));

			expect(guarded.status).toBe('approaching');
		});
	});

	describe('several Guards over one Task', () => {
		it('lands both deferrals when two Guards reach the same Task', () => {
			const guarded = byId(
				applyGuards(scenarioTasks, guardScenarioRules, plants, rainyWindow, asOf),
				figFertilizer.id,
			);

			expect(guarded.status).toBe('deferred');
			expect(guarded.deferrals.map(deferral => deferral.guardId)).toEqual([rainGuard.id, springGuard.id]);
		});

		it('lands a deferral and an annotation side by side', () => {
			const guarded = byId(
				applyGuards(scenarioTasks, guardScenarioRules, plants, rainyWindow, asOf),
				fallPreEmergentSoil.id,
			);

			expect(guarded.deferrals.map(deferral => deferral.guardId)).toEqual([rainGuard.id]);
			expect(guarded.annotations.map(annotation => annotation.guardId)).toEqual([waterInGuard.id]);
		});

		it('defers an approaching Task into deferred, keeping its projection', () => {
			// `taskSchema` allows one status and requires 'deferred' wherever a
			// deferral sits, so the forecast reading survives in the Citation
			// rather than in a combined status nobody can express.
			const approaching = taskFor('fall-pre-emergent-soil', 'front-lawn', {
				status: 'approaching',
				citation: {
					kind: 'threshold-projection',
					variable: 'soil-temperature',
					depthCm: 6,
					aggregate: 'mean',
					projectedDate: '2026-09-14',
				},
			});

			const guarded = only(applyGuards([approaching], rules, plants, rainyWindow, asOf));

			expect(guarded.status).toBe('deferred');
			expect(guarded.citation).toEqual(approaching.citation);
		});
	});
});
