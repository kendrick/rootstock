import type { Task } from '@/planner/task';
import { describe, expect, it } from 'vitest';
import { taskId } from '@/planner/task';
import { ticketLinesFor } from './ticket-lines';

function task(ruleId: string, plantId: string | null, status: Task['status']): Task {
	return {
		id: taskId(ruleId, plantId),
		ruleId,
		plantId,
		status,
		citation: { kind: 'window', date: '2026-09-28' },
		deferrals: [],
		annotations: [],
		delegable: false,
		tags: [],
		title: `${ruleId} for ${plantId ?? 'the yard'}`,
		guardChecks: null,
	};
}

// This Week numbers Ready now and Held back separately, each from one, in Plan
// order. The expected labels are the ones that page prints for this Plan.
const tasks: Task[] = [
	task('fall-pre-emergent', 'front-lawn', 'deferred'),
	task('last-nitrogen', 'front-lawn', 'fired'),
	task('soil-threshold-pre-emergent', 'front-lawn', 'approaching'),
	task('feed-containers', 'esperanza-1', 'fired'),
	task('feed-containers', 'hibiscus-luna-white', 'deferred'),
	task('feed-containers', 'fig-1', 'fired'),
];

describe('ticketLinesFor', () => {
	it('numbers a Rule\'s lines where the ticket numbers them, not from its own first Task', () => {
		expect(ticketLinesFor('last-nitrogen', tasks).map(line => line.label)).toEqual(['Ready now 01']);
		expect(ticketLinesFor('fall-pre-emergent', tasks).map(line => line.label)).toEqual(['Held back 01']);
	});

	it('gives a Rule with Tasks for several Plants one line per Plant, in Plan order', () => {
		expect(ticketLinesFor('feed-containers', tasks)).toEqual([
			{ label: 'Ready now 02', href: '/rootstock/#ready-now-02', plantId: 'esperanza-1' },
			{ label: 'Held back 02', href: '/rootstock/#held-back-02', plantId: 'hibiscus-luna-white' },
			{ label: 'Ready now 03', href: '/rootstock/#ready-now-03', plantId: 'fig-1' },
		]);
	});

	it('links no approaching work, which the Fired band never holds', () => {
		expect(ticketLinesFor('soil-threshold-pre-emergent', tasks)).toEqual([]);
	});
});
