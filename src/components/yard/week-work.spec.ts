import type { Task } from '@/planner/task';
import { describe, expect, it } from 'vitest';
import { narratedArtifact } from '@/artifact/fixtures';
import { ticketLabel, ticketLines } from './week-work';

const template = narratedArtifact.plan.tasks[0];
if (template === undefined) {
	throw new Error('the artifact fixture carries no Task to build from');
}

function task(id: string, status: Task['status'], ruleId: string, plantId: string | null): Task {
	return { ...template!, id, status, ruleId, plantId } as Task;
}

describe('ticketLines', () => {
	/*
	 * The numbers are written out from how This Week numbers its groups (each
	 * from one, in Plan order), not worked out the way this function does. The
	 * yard-wide Task still takes a Ready now number, because the ticket counts
	 * it, even though no Plant row shows it.
	 */
	it('numbers each group from one in Plan order, as the ticket does', () => {
		const lines = ticketLines([
			task('a', 'fired', 'fall-pre-emergent', 'front-lawn'),
			task('b', 'deferred', 'deep-water-fig', 'fig-1'),
			task('c', 'fired', 'yard-cleanup', null),
			task('d', 'fired', 'esperanza-feeding', 'esperanza-1'),
			task('e', 'approaching', 'spring-pre-emergent', 'front-lawn'),
		]);

		expect(lines.get('front-lawn')?.map(ticketLabel)).toEqual(['Ready now 01', 'Approaching 01']);
		expect(lines.get('esperanza-1')?.map(ticketLabel)).toEqual(['Ready now 03']);
		expect(lines.get('fig-1')?.map(ticketLabel)).toEqual(['Held back 01']);
		expect(lines.size).toBe(3);
	});
});
