import type { AppliesTo, Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { describe, expect, it } from 'vitest';
import { ruleSchema } from '@/rules/rule';
import { plantSchema } from '@/yard/plant';
import { plants } from './fixtures';
import { targets } from './targets';

// fixtures.ts has no task-creating Rule at whole-yard scope (its only all-null
// appliesTo belongs to a Guard), so the whole-yard and ruleTags-only cases
// below need a Rule of their own rather than one borrowed from there.
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

function plant(id: string, options: { status?: Plant['status']; tags?: string[] } = {}): Plant {
	return plantSchema.parse({
		id,
		name: id,
		kind: 'plant',
		status: options.status ?? 'planted',
		tags: options.tags ?? [],
	});
}

// fixtures.plants in id order: the front lawn, the fig, and the esperanza.
const [frontLawn, fig, esperanza] = plants;

describe('targets', () => {
	it('applies to the whole yard when appliesTo is all null', () => {
		const rule = windowRule('whole-yard', { plantIds: null, plantTags: null, ruleTags: null });

		expect(targets(rule, plants)).toEqual({ specificity: 1, plants: null });
	});

	it('still applies to the whole yard when appliesTo carries only ruleTags', () => {
		// ruleTags selects Rules for a Guard to read, not Plants for this Rule to
		// reach. A task-creating Rule that sets it anyway is read as though the
		// field were null, never as an error.
		const rule = windowRule('rule-tags-only', { plantIds: null, plantTags: null, ruleTags: ['pre-emergent'] });

		expect(targets(rule, plants)).toEqual({ specificity: 1, plants: null });
	});

	it('selects Plants named by id, at specificity 3', () => {
		const rule = windowRule('by-id', { plantIds: ['front-lawn'], plantTags: null, ruleTags: null });

		expect(targets(rule, plants)).toEqual({ specificity: 3, plants: [frontLawn] });
	});

	it('selects Plants by tag alone, at specificity 2', () => {
		const rule = windowRule('by-tag', { plantIds: null, plantTags: ['fruit'], ruleTags: null });

		// pomegranate-1 also carries the 'fruit' tag but is only planned, so it
		// does not show up here even though the tag selector reaches it.
		expect(targets(rule, plants)).toEqual({ specificity: 2, plants: [fig] });
	});

	it('unions id and tag selectors while keeping specificity at 3', () => {
		const rule = windowRule('by-both', { plantIds: ['esperanza-1'], plantTags: ['fig'], ruleTags: null });

		expect(targets(rule, plants)).toEqual({ specificity: 3, plants: [fig, esperanza] });
	});

	it('excludes a planned Plant even when named by id', () => {
		const rule = windowRule('planned-by-id', { plantIds: ['pomegranate-1'], plantTags: null, ruleTags: null });

		// The fixture only proves this if pomegranate-1 is still planned; guard
		// the assumption so a fixture edit fails here instead of loosening what
		// this test actually covers.
		expect(plants.some(candidate => candidate.id === 'pomegranate-1' && candidate.status === 'planned')).toBe(true);
		expect(targets(rule, plants)).toEqual({ specificity: 3, plants: [] });
	});

	it('returns an empty list, not an error, when a named id matches no Plant', () => {
		const rule = windowRule('missing-id', { plantIds: ['no-such-plant'], plantTags: null, ruleTags: null });

		expect(targets(rule, plants)).toEqual({ specificity: 3, plants: [] });
	});

	it('returns matches in the order the plants argument lists them', () => {
		const b = plant('b', { tags: ['sel'] });
		const a = plant('a', { tags: ['sel'] });
		const rule = windowRule('order-check', { plantIds: null, plantTags: ['sel'], ruleTags: null });

		expect(targets(rule, [b, a]).plants).toEqual([b, a]);
	});
});
