import { describe, expect, it } from 'vitest';
import { seedOccurrences, seedPlants, seedRules, seedTagPolicy } from '@/seed';
import { plannedFrom, seedPlannedFrom } from './planned-from';

const seed = { rules: seedRules, plants: seedPlants, occurrences: seedOccurrences, tagPolicy: seedTagPolicy };

describe('plannedFrom', () => {
	it('gives the same fingerprint for the same inputs', () => {
		expect(plannedFrom(seed)).toBe(plannedFrom(structuredClone(seed)));
		expect(seedPlannedFrom).toBe(plannedFrom(seed));
	});

	// Any change to what the Planner reads has to show, or the site can't tell
	// a Plan made from other Rules from one made from these.
	it('changes when a Rule, a Plant, an Occurrence or the tag policy changes', () => {
		const base = plannedFrom(seed);
		const [firstRule, ...rules] = seedRules;
		const [firstPlant, ...plants] = seedPlants;

		expect(plannedFrom({ ...seed, rules: [{ ...firstRule!, name: `${firstRule!.name}!` }, ...rules] })).not.toBe(base);
		expect(plannedFrom({ ...seed, plants: [{ ...firstPlant!, tags: [...firstPlant!.tags, 'new-tag'] }, ...plants] })).not.toBe(base);
		expect(plannedFrom({ ...seed, occurrences: seedOccurrences.slice(1) })).not.toBe(base);
		expect(plannedFrom({ ...seed, tagPolicy: { ...seedTagPolicy, neverDelegableTags: [...seedTagPolicy.neverDelegableTags, 'x'] } })).not.toBe(base);
	});

	it('is a short hex string', () => {
		expect(plannedFrom(seed)).toMatch(/^[0-9a-f]{16}$/u);
	});
});
