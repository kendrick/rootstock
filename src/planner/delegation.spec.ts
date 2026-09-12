import type { Rule, TagPolicy } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { ruleSchema } from '@/rules/rule';
import { isDelegable } from './delegation';

// Builds a window Rule through the real schema rather than an object-literal
// cast, the same reasoning targets.spec.ts's windowRule helper documents:
// isDelegable only cares about delegable and tags, but parseWith still has to
// accept the object as a well-formed Rule, chemical's productLabel refine
// included.
function rule(options: { delegable: boolean; tags?: string[]; productLabel?: { url: string } | null }): Rule {
	return ruleSchema.parse({
		id: 'a-rule',
		name: 'a-rule',
		kind: 'window',
		region: { name: 'Fort Worth', hardinessZone: '8b' },
		source: { kind: 'owner', label: 'House practice', url: null },
		tags: options.tags ?? [],
		delegable: options.delegable,
		priority: 1,
		appliesTo: { plantIds: null, plantTags: null, ruleTags: null },
		productLabel: options.productLabel ?? null,
		start: '01-01',
		end: '01-02',
	});
}

function tagPolicy(neverDelegableTags: string[]): TagPolicy {
	return { neverDelegableTags, safetyTags: [] };
}

describe('isDelegable', () => {
	it('is true for a plain delegable Rule when no tag is policy-listed', () => {
		const target = rule({ delegable: true, tags: ['fertilizer'] });

		expect(isDelegable(target, tagPolicy(['chemical']))).toBe(true);
	});

	it('is false for a chemical Rule with delegable true, against a policy naming chemical', () => {
		// rule.ts refuses a chemical-tagged Rule with no productLabel, so the
		// fixture needs one even though isDelegable never reads the field.
		const target = rule({ delegable: true, tags: ['chemical'], productLabel: { url: 'https://example.com/label' } });

		expect(isDelegable(target, tagPolicy(['chemical']))).toBe(false);
	});

	it('is false for a Rule with delegable false and no policy-listed tag', () => {
		const target = rule({ delegable: false, tags: ['fertilizer'] });

		expect(isDelegable(target, tagPolicy(['chemical']))).toBe(false);
	});

	it('stays false for a delegable-false Rule even against an empty neverDelegableTags', () => {
		// The direction the tag policy is allowed to move in: it narrows a
		// delegable Rule, but an empty or unrelated list can never widen one
		// that already said no.
		const target = rule({ delegable: false, tags: ['fertilizer'] });

		expect(isDelegable(target, tagPolicy([]))).toBe(false);
	});

	it('is false when only one of several tags is policy-listed', () => {
		const target = rule({ delegable: true, tags: ['fertilizer', 'chemical', 'seasonal'], productLabel: { url: 'https://example.com/label' } });

		expect(isDelegable(target, tagPolicy(['chemical']))).toBe(false);
	});

	it('leaves a delegable Rule alone when neverDelegableTags is empty', () => {
		const target = rule({ delegable: true, tags: ['fertilizer'] });

		expect(isDelegable(target, tagPolicy([]))).toBe(true);
	});
});
