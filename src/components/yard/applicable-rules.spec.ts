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
const plannedCrossvine = seedPlants.find(plant => plant.id === 'crossvine-1')!;

describe('rulesFor', () => {
	it('reaches a lawn through the Rules that name it and the Guards that hold their work', () => {
		// Four task-creating Rules name front-lawn by id. Both Guards join them
		// without naming any Plant of their own: three of those four Rules are
		// tagged `chemical`, which is the tag both Guards' ruleTags select.
		expect(rulesFor(frontLawn, seedRules, seedPlants).map(rule => rule.id)).toEqual([
			'fall-pre-emergent',
			'last-nitrogen',
			'spring-pre-emergent',
			'spring-pre-emergent-follow-up',
			'rain-expected',
			'water-in-after-application',
		]);
	});

	it('reaches a tagged plant through a tag-matched task-creating Rule', () => {
		// fig-1 carries two task-creating Rules that name it directly by id, so
		// this hand-authored Rule selects it by the 'fruit' tag instead, with no
		// plantIds of its own, to prove the tag half of targets() reaches this
		// function's result on its own strength.
		const fruitCare = windowRule('fruit-care', { plantIds: null, plantTags: ['fruit'], ruleTags: null });
		const rules = [fruitCare, ...seedRules];

		// Both fig-1 Rules named by id join fruitCare, in seed order. Neither
		// Guard follows: both select ruleTags: ['chemical'], and none of the
		// three Rules reaching the fig carries that tag.
		expect(rulesFor(fig, rules, seedPlants).map(rule => rule.id)).toEqual([
			'fruit-care',
			'fig-spring-nitrogen',
			'fig-spring-compost',
		]);
	});

	// The regression this function was rewritten for. `rain-expected` names no
	// Plant at all and reaches the lawn purely through ruleTags: ['chemical'],
	// which the lawn's three pre-emergent Rules carry. It is the Guard actually
	// holding the herbicide back, and ADR 0002 is explicit that held work stays
	// visible with the reason attached—so hiding it here defeats the point of
	// deferring rather than deleting.
	it('reaches a plant through a Guard that names no plant but matches a Rule tag', () => {
		expect(rulesFor(frontLawn, seedRules, seedPlants).map(rule => rule.id)).toContain('rain-expected');
	});

	// The same Guard, on a plant whose Rules are not chemical. The esperanza is
	// fed and nothing more, so the rain Guard has nothing of its to hold.
	it('leaves that Guard off a plant carrying none of its rule tags', () => {
		expect(rulesFor(esperanza, seedRules, seedPlants).map(rule => rule.id)).not.toContain('rain-expected');
	});

	// The seed's two Guards both select ruleTags: ['chemical'], and fig-1's task-
	// creating Rules carry fruit/fertilizer/nitrogen and fruit/compost between
	// them—no chemical tag anywhere—so neither Guard belongs on its page. Both
	// Guards leave plantIds and plantTags null, so if the ruleTags half of this
	// check ever stopped narrowing, both would reach fig-1 on the plant half
	// alone and this would start failing.
	it('leaves off both Guards on a plant whose Rules carry no matching rule tag', () => {
		const reached = rulesFor(fig, seedRules, seedPlants).map(rule => rule.id);

		expect(reached).not.toContain('rain-expected');
		expect(reached).not.toContain('water-in-after-application');
	});

	// A Guard with every selector null reaches every Task in a Plan, so it
	// reaches every Plant here too, with no Rule tag to narrow it.
	it('reaches every plant through a Guard that constrains nothing', () => {
		const houseRule = guardRule('house-rule', { plantIds: null, plantTags: null, ruleTags: null });

		expect(rulesFor(fig, [houseRule], seedPlants).map(rule => rule.id)).toEqual(['house-rule']);
		expect(rulesFor(frontLawn, [houseRule], seedPlants).map(rule => rule.id)).toEqual(['house-rule']);
	});

	it('reaches every planted Plant through a whole-yard task-creating Rule', () => {
		const wholeYard = windowRule('whole-yard-check', { plantIds: null, plantTags: null, ruleTags: null });

		expect(rulesFor(esperanza, [wholeYard], seedPlants).map(rule => rule.id)).toEqual(['whole-yard-check']);
		expect(rulesFor(frontLawn, [wholeYard], seedPlants).map(rule => rule.id)).toEqual(['whole-yard-check']);
	});

	// guardTargets() unions plantIds and plantTags to pick a Guard's Tasks, and
	// this has to agree with it. Reading plantIds alone would let a Guard written
	// against every fig in the yard miss the only fig in it.
	it('reaches a plant a Guard selects by tag rather than by id', () => {
		const tagOnlyGuard = guardRule('tag-only-guard', { plantIds: null, plantTags: ['fig'], ruleTags: null });

		expect(rulesFor(fig, [tagOnlyGuard], seedPlants).map(rule => rule.id)).toEqual(['tag-only-guard']);
	});

	// A planned Plant is not in the ground, so targets() drops it and the Guard
	// written for its tag has nothing to reach yet.
	it('leaves a tag-selected Guard off a plant that is only planned', () => {
		const vineGuard = guardRule('vine-guard', { plantIds: null, plantTags: ['vine'], ruleTags: null });

		expect(rulesFor(plannedCrossvine, [vineGuard], seedPlants)).toEqual([]);
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
