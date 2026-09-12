import type { AppliesTo, Rule } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { ruleSchema } from '@/rules/rule';
import { seedPlants, seedRules } from '@/seed';
import { rulesFor } from './applicable-rules';

// Hand-authored rather than pulled from fixtures.ts: that file is owned by a
// peer task landing alongside this one, so building against it here would be
// building against a moving target.
function windowRule(id: string, appliesTo: AppliesTo): Rule {
	return ruleSchema.parse({
		id,
		name: id,
		kind: 'window',
		region: { name: 'Fort Worth', hardinessZone: '8b' },
		source: { kind: 'owner', label: 'House practice', url: null },
		tags: [],
		delegable: true,
		priority: 1,
		appliesTo,
		productLabel: null,
		start: '01-01',
		end: '01-02',
	});
}

function guardRule(id: string, appliesTo: AppliesTo): Rule {
	return ruleSchema.parse({
		id,
		name: id,
		kind: 'guard',
		region: { name: 'Fort Worth', hardinessZone: '8b' },
		source: { kind: 'owner', label: 'House practice', url: null },
		tags: [],
		delegable: true,
		priority: 1,
		appliesTo,
		productLabel: null,
		condition: { kind: 'always' },
		effect: 'annotate',
		text: 'test guard',
	});
}

const frontLawn = seedPlants.find(plant => plant.id === 'front-lawn')!;
const fig = seedPlants.find(plant => plant.id === 'fig-1')!;
const esperanza = seedPlants.find(plant => plant.id === 'esperanza-1')!;

describe('rulesFor', () => {
	it('reaches a lawn through the task-creating Rules that name it by id, and no Guard that does not', () => {
		// The seed set's only Rules naming front-lawn are these four; its three
		// Guards all carry appliesTo.plantIds: null, so none of them name any
		// Plant by id and none should show up here.
		expect(rulesFor(frontLawn, seedRules, seedPlants).map(rule => rule.id)).toEqual([
			'fall-pre-emergent',
			'last-nitrogen',
			'spring-pre-emergent',
			'spring-pre-emergent-follow-up',
		]);
	});

	it('reaches a tagged plant through a tag-matched task-creating Rule, plus a Guard naming it by id', () => {
		// fig-1 carries the 'fruit' tag but is never named by id in a
		// task-creating Rule, so a hand-authored one proves the tag half of
		// targets() reaches this function's result.
		const fruitCare = windowRule('fruit-care', { plantIds: null, plantTags: ['fruit'], ruleTags: null });
		const rules = [fruitCare, ...seedRules];

		// fig-fertilizer-until-spring is the seed set's only Guard naming fig-1
		// in appliesTo.plantIds; the other Guards target no Plant by id and are
		// excluded the same way they were for the lawn above.
		expect(rulesFor(fig, rules, seedPlants).map(rule => rule.id)).toEqual([
			'fruit-care',
			'fig-fertilizer-until-spring',
		]);
	});

	it('reaches every planted Plant through a whole-yard task-creating Rule', () => {
		const wholeYard = windowRule('whole-yard-check', { plantIds: null, plantTags: null, ruleTags: null });

		expect(rulesFor(esperanza, [wholeYard], seedPlants).map(rule => rule.id)).toEqual(['whole-yard-check']);
		expect(rulesFor(frontLawn, [wholeYard], seedPlants).map(rule => rule.id)).toEqual(['whole-yard-check']);
	});

	it('excludes a Guard that constrains by plantTags alone, since only plantIds names a Plant here', () => {
		// guardTargets() would union plantIds and plantTags to pick a Guard's
		// Tasks, but this function is answering a different question with no
		// Tasks to hand it — appliesTo.plantIds is read directly, so a Guard
		// that only ever named the fig by tag does not reach it here.
		const tagOnlyGuard = guardRule('tag-only-guard', { plantIds: null, plantTags: ['fig'], ruleTags: null });

		expect(rulesFor(fig, [tagOnlyGuard], seedPlants)).toEqual([]);
	});

	it('preserves the input order of rules and returns each match once', () => {
		const byId = windowRule('by-id', { plantIds: ['front-lawn'], plantTags: null, ruleTags: null });
		const unrelated = windowRule('unrelated', { plantIds: ['esperanza-1'], plantTags: null, ruleTags: null });
		const guard = guardRule('guard-front-lawn', { plantIds: ['front-lawn'], plantTags: null, ruleTags: null });

		expect(rulesFor(frontLawn, [unrelated, guard, byId], seedPlants).map(rule => rule.id)).toEqual([
			'guard-front-lawn',
			'by-id',
		]);
	});
});
