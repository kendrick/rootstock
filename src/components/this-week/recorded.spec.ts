import type { Occurrence } from '@/planner/occurrence';
import { describe, expect, it, vi } from 'vitest';
import { combinedNarratedArtifact, rulesById } from './fixtures';
import { announceRecorded, onRecorded, recordedDates } from './recorded';

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
