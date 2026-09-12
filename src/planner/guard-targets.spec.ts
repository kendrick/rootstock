import type { Task } from './task';
import type { AppliesTo, GuardRule, Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { describe, expect, it } from 'vitest';
import { guardRuleSchema, ruleSchema } from '@/rules/rule';
import { plantSchema } from '@/yard/plant';
import { guardTargets } from './guard-targets';
import { taskId, taskSchema } from './task';

// This file builds its own small yard rather than reaching for fixtures.ts.
// Telling the two readings of `appliesTo` apart takes two Rules tagged
// `fertilizer` on different plants, the fig's feeding and the lawn's last
// nitrogen, and fixtures.ts carries neither: it was assembled to cover the
// shapes the Planner branches on.

const region = { name: 'Fort Worth', hardinessZone: '8b' };
const source = { kind: 'owner', label: 'House practice', url: null };

function windowRule(id: string, tags: string[], appliesTo: AppliesTo): Rule {
	return ruleSchema.parse({
		id,
		name: id,
		kind: 'window',
		region,
		source,
		tags,
		delegable: true,
		priority: 10,
		appliesTo,
		productLabel: null,
		start: '01-01',
		end: '12-31',
	});
}

function guardRule(id: string, appliesTo: AppliesTo, effect: 'annotate' | 'defer' = 'defer'): GuardRule {
	const base = {
		id,
		name: id,
		kind: 'guard',
		region,
		source,
		tags: [],
		delegable: false,
		priority: 90,
		appliesTo,
		productLabel: null,
		condition: { kind: 'always' },
	};

	return guardRuleSchema.parse(
		effect === 'annotate'
			? { ...base, effect: 'annotate', text: 'Water it in within 48 hours.' }
			: { ...base, effect: 'defer', release: 'Once the fig breaks dormancy' },
	);
}

function plant(id: string, tags: string[]): Plant {
	return plantSchema.parse({ id, name: id, kind: 'plant', status: 'planted', tags });
}

function task(ruleId: string, plantId: string | null, tags: string[] = []): Task {
	return taskSchema.parse({
		id: taskId(ruleId, plantId),
		ruleId,
		plantId,
		status: 'fired',
		citation: { kind: 'window', date: '2026-09-11' },
		deferrals: [],
		annotations: [],
		delegable: true,
		tags,
		title: ruleId,
	});
}

const frontLawn = plantSchema.parse({
	id: 'front-lawn',
	name: 'Front lawn',
	kind: 'lawn',
	status: 'planted',
	tags: ['lawn'],
	lawn: {
		grass: 'Bermuda',
		areaSqFt: 3200,
		soil: 'clay loam',
		irrigation: { schedule: 'Tuesdays before dawn', source: 'asserted' },
	},
});
const fig = plant('fig-1', ['fruit', 'fig']);
const esperanza = plant('esperanza-1', ['flowering', 'container']);
const plants = [frontLawn, fig, esperanza];

const rules = [
	windowRule('last-nitrogen', ['lawn', 'fertilizer'], { plantIds: ['front-lawn'], plantTags: null, ruleTags: null }),
	windowRule('fig-feeding', ['fertilizer'], { plantIds: ['fig-1'], plantTags: null, ruleTags: null }),
	windowRule('fig-mulch', ['mulch'], { plantIds: ['fig-1'], plantTags: null, ruleTags: null }),
	windowRule('esperanza-feeding', ['fertilizer'], { plantIds: ['esperanza-1'], plantTags: null, ruleTags: null }),
	windowRule('deep-watering', ['watering'], { plantIds: null, plantTags: null, ruleTags: null }),
];

const lastNitrogen = task('last-nitrogen', 'front-lawn');
const figFeeding = task('fig-feeding', 'fig-1');
const figMulch = task('fig-mulch', 'fig-1');
const esperanzaFeeding = task('esperanza-feeding', 'esperanza-1');
// `deep-watering` names no plant, so the Planner authors one Task for the
// whole yard rather than one per Plant, and its plantId is null.
const wholeYard = task('deep-watering', null);

const tasks = [lastNitrogen, figFeeding, figMulch, esperanzaFeeding, wholeYard];

describe('guardTargets', () => {
	it('reaches every Task when all three selectors are null', () => {
		const guard = guardRule('house-rule', { plantIds: null, plantTags: null, ruleTags: null });

		expect(guardTargets(guard, tasks, rules, plants)).toEqual(tasks);
	});

	it('reaches only Tasks on the Plants named by id', () => {
		const guard = guardRule('fig-only', { plantIds: ['fig-1'], plantTags: null, ruleTags: null });

		expect(guardTargets(guard, tasks, rules, plants)).toEqual([figFeeding, figMulch]);
	});

	it('reaches Tasks whose Plant carries one of the selected tags', () => {
		const guard = guardRule('fruit-only', { plantIds: null, plantTags: ['fruit'], ruleTags: null });

		expect(guardTargets(guard, tasks, rules, plants)).toEqual([figFeeding, figMulch]);
	});

	it('unions the two plant selectors', () => {
		const guard = guardRule('fig-and-containers', { plantIds: ['front-lawn'], plantTags: ['container'], ruleTags: null });

		expect(guardTargets(guard, tasks, rules, plants)).toEqual([lastNitrogen, esperanzaFeeding]);
	});

	it('reaches every Task from a Rule carrying a selected ruleTag, whatever its plant', () => {
		const guard = guardRule('all-feeding', { plantIds: null, plantTags: null, ruleTags: ['fertilizer'] });

		expect(guardTargets(guard, tasks, rules, plants)).toEqual([lastNitrogen, figFeeding, esperanzaFeeding]);
	});

	it('intersects the plant group with ruleTags rather than unioning all three selectors', () => {
		// The case the whole-OR reading gets wrong in both directions: it would
		// pull in the lawn's last nitrogen through the tag and the fig's mulch
		// through the id, and September's lawn feeding would arrive deferred by
		// a Guard written about the fig.
		const guard = guardRule('fig-fertilizer-window', { plantIds: ['fig-1'], plantTags: null, ruleTags: ['fertilizer'] });

		const reached = guardTargets(guard, tasks, rules, plants);

		expect(reached).toEqual([figFeeding]);
		expect(reached).not.toContain(lastNitrogen);
		expect(reached).not.toContain(figMulch);
	});

	it('does not reach a whole-yard Task when the plant group constrains', () => {
		const guard = guardRule('fig-only', { plantIds: ['fig-1'], plantTags: null, ruleTags: null });

		expect(guardTargets(guard, tasks, rules, plants)).not.toContain(wholeYard);
	});

	it('reaches a whole-yard Task when only ruleTags constrains', () => {
		const guard = guardRule('watering-hold', { plantIds: null, plantTags: null, ruleTags: ['watering'] });

		expect(guardTargets(guard, tasks, rules, plants)).toEqual([wholeYard]);
	});

	it('matches a plantId naming a Plant that is not in the inventory', () => {
		// The id half compares strings and never needs the record, so a Plan
		// carrying a Task for a Plant somebody has since removed is still
		// something a Guard can hold back.
		const orphan = task('fig-feeding', 'pomegranate-1');
		const guard = guardRule('pomegranate-hold', { plantIds: ['pomegranate-1'], plantTags: null, ruleTags: null });

		expect(guardTargets(guard, [orphan], rules, plants)).toEqual([orphan]);
	});

	it('cannot match a missing Plant by tag, and does not treat that as an error', () => {
		const orphan = task('fig-feeding', 'pomegranate-1');
		const guard = guardRule('fruit-hold', { plantIds: null, plantTags: ['fruit'], ruleTags: null });

		expect(guardTargets(guard, [orphan], rules, plants)).toEqual([]);
	});

	it('cannot match a ruleTag against a Rule that is not in the rule set', () => {
		const stray = task('no-such-rule', 'fig-1');
		const guard = guardRule('fertilizer-hold', { plantIds: null, plantTags: null, ruleTags: ['fertilizer'] });

		expect(guardTargets(guard, [stray], rules, plants)).toEqual([]);
	});

	it('reads ruleTags against the Rule, not against the Task tags copied from it', () => {
		// A Task carries its own tags, and they usually agree with the Rule's.
		// Reading the copy would make a Guard's reach depend on the transcription
		// rather than on what the Rule says about itself.
		const mislabelled = task('fig-mulch', 'fig-1', ['fertilizer']);
		const guard = guardRule('fertilizer-hold', { plantIds: null, plantTags: null, ruleTags: ['fertilizer'] });

		expect(guardTargets(guard, [mislabelled], rules, plants)).toEqual([]);
	});

	it('targets the same Tasks whether the Guard defers or annotates', () => {
		const appliesTo = { plantIds: ['fig-1'], plantTags: null, ruleTags: ['fertilizer'] };

		expect(guardTargets(guardRule('annotating', appliesTo, 'annotate'), tasks, rules, plants))
			.toEqual(guardTargets(guardRule('deferring', appliesTo, 'defer'), tasks, rules, plants));
	});

	it('returns the Tasks themselves, in the order the tasks argument lists them', () => {
		const guard = guardRule('house-rule', { plantIds: null, plantTags: null, ruleTags: null });
		const reversed = [...tasks].reverse();

		const reached = guardTargets(guard, reversed, rules, plants);

		expect(reached).toEqual(reversed);
		expect(reached[0]).toBe(wholeYard);
	});
});
