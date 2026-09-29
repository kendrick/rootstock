import type { Occurrence } from '@/planner/occurrence';
import { describe, expect, it } from 'vitest';
import { seedPlants } from '@/seed';
import { anchorFor, recordedDay } from './anchor';
import { cadenceRule, delegableRule, thresholdRule } from './fixtures';

function occurrence(id: string, ruleId: string, plantId: string | null, completedAt: string): Occurrence {
	return { id, ruleId, plantId, completedAt, recordedAt: completedAt, source: 'seed' };
}

// Written from CONTEXT.md's Anchor: the most recent Occurrence of the Rule a
// follow-up follows, for the Plant its Task would be for.
describe('anchorFor', () => {
	it('is null when the Rule it follows has nothing on record', () => {
		expect(anchorFor(cadenceRule, [], seedPlants)).toBeNull();
	});

	it('takes the latest completed record, however late it was written', () => {
		const earlier = occurrence('a', thresholdRule.id, 'front-lawn', '2026-03-03T00:00:00Z');
		const later = { ...occurrence('b', thresholdRule.id, 'front-lawn', '2026-03-10T00:00:00Z'), recordedAt: '2026-03-10T00:00:00Z' };
		const backfilled = { ...occurrence('c', thresholdRule.id, 'front-lawn', '2026-03-01T00:00:00Z'), recordedAt: '2026-04-01T00:00:00Z' };

		expect(anchorFor(cadenceRule, [earlier, later, backfilled], seedPlants)).toEqual({ occurrence: later, plantName: null });
	});

	// The Planner anchors each Plant on its own record, so the next Task counts
	// from the earliest of those. Mar 1 for the fig comes due before Mar 10 for
	// the lawn, whatever older records either Plant carries.
	it('takes the earliest of each Plant\'s latest record, and names that Plant', () => {
		const twoPlants = { ...cadenceRule, appliesTo: { plantIds: ['front-lawn', 'fig-1'], plantTags: null, ruleTags: null } };
		const lawnOld = occurrence('lawn-old', thresholdRule.id, 'front-lawn', '2026-02-20T00:00:00Z');
		const lawn = occurrence('lawn', thresholdRule.id, 'front-lawn', '2026-03-10T00:00:00Z');
		const fig = occurrence('fig', thresholdRule.id, 'fig-1', '2026-03-01T00:00:00Z');

		expect(anchorFor(twoPlants, [lawnOld, lawn, fig], seedPlants)).toEqual({ occurrence: fig, plantName: 'Brown Turkey fig' });
	});

	// A Plant with no record gets no Task from the Planner, so it can't be the
	// one that comes due first.
	it('passes over a reached Plant with nothing on record', () => {
		const twoPlants = { ...cadenceRule, appliesTo: { plantIds: ['front-lawn', 'fig-1'], plantTags: null, ruleTags: null } };
		const lawn = occurrence('lawn', thresholdRule.id, 'front-lawn', '2026-03-10T00:00:00Z');

		expect(anchorFor(twoPlants, [lawn], seedPlants)).toEqual({ occurrence: lawn, plantName: 'Front lawn' });
	});

	it('ignores a record for a Plant the follow-up doesn\'t reach', () => {
		expect(anchorFor(cadenceRule, [occurrence('a', thresholdRule.id, 'fig-1', '2026-03-03T00:00:00Z')], seedPlants)).toBeNull();
	});

	it('is null for a Cadence Rule that follows nothing', () => {
		expect(anchorFor(delegableRule, [occurrence('a', delegableRule.id, 'esperanza-1', '2026-03-03T00:00:00Z')], seedPlants)).toBeNull();
	});
});

describe('recordedDay', () => {
	// The UTC day, as This Week's record line prints it. The year stays, since
	// the anchor can be last season's.
	it('names the UTC day with its year', () => {
		expect(recordedDay(occurrence('a', 'r', null, '2025-03-03T23:30:00Z'))).toBe('March 3, 2025');
	});
});
