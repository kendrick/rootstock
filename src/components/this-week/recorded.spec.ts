import type { Occurrence } from '@/planner/occurrence';
import { describe, expect, it, vi } from 'vitest';
import { combinedNarratedArtifact, rulesById } from './fixtures';
import { announceRecorded, onRecorded, recordedDates, weekCounts } from './recorded';

const { asOf, tasks } = combinedNarratedArtifact.plan;

const fired = tasks.find(task => task.id === 'fall-pre-emergent@front-lawn');
if (fired === undefined) {
	throw new Error('the this-week fixture no longer carries fall-pre-emergent@front-lawn');
}

function occurrence(completedAt: string, overrides: Partial<Occurrence> = {}): Occurrence {
	return {
		id: `o-${completedAt.slice(0, 10)}`,
		ruleId: fired?.ruleId ?? '',
		plantId: fired?.plantId ?? null,
		completedAt,
		recordedAt: completedAt,
		source: 'browser',
		...overrides,
	};
}

describe('recordedDates', () => {
	it('names nothing when the history is empty', () => {
		expect(recordedDates(tasks, [], asOf, rulesById).size).toBe(0);
	});

	it('dates a recorded Task to the day its Occurrence carries', () => {
		const dates = recordedDates(tasks, [occurrence(`${asOf}T12:00:00Z`)], asOf, rulesById);

		expect(dates.get(fired.id)).toBe(asOf);
		expect(dates.size).toBe(1);
	});

	// Filed under (ruleId, plantId), so the same Rule recorded for another
	// Plant must not count for this one.
	it('ignores an Occurrence filed against a different Plant', () => {
		const other = occurrence(`${asOf}T12:00:00Z`, { plantId: 'back-lawn' });

		expect(recordedDates(tasks, [other], asOf, rulesById).has(fired.id)).toBe(false);
	});
});

describe('weekCounts', () => {
	// Approaching work cannot be signed off, so it is never open and never
	// keeps a finished week from closing.
	// The fixture is two fired Tasks, one deferred and one approaching, so the
	// expected figures are written out rather than worked out the way the
	// function works them out.
	it('counts approaching work apart from what can be signed off', () => {
		expect(weekCounts(tasks, new Set())).toEqual({ signable: 3, recorded: 0, open: 3, approaching: 1 });
	});

	it('reaches zero open once the three signable Tasks are recorded', () => {
		const signableIds = new Set(tasks.filter(task => task.status !== 'approaching').map(task => task.id));

		expect(weekCounts(tasks, signableIds)).toEqual({ signable: 3, recorded: 3, open: 0, approaching: 1 });
	});
});

describe('onRecorded', () => {
	it('tells a subscriber, and stops once it unsubscribes', () => {
		const listener = vi.fn();
		const stop = onRecorded(listener);

		announceRecorded();
		stop();
		announceRecorded();

		expect(listener).toHaveBeenCalledTimes(1);
	});
});
