import type { Task } from '@/planner/task';
import { describe, expect, it } from 'vitest';
import { narratedArtifact } from '@/artifact/fixtures';
import { ticketLabel, ticketLines, weekLine } from './week-work';

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

// What the Yard says above the plate: the Plan's own date, so the page says
// which week it means, and how much of the ticket lands on Plants.
describe('weekLine', () => {
	const line = (group: 'Ready now' | 'Approaching' | 'Held back', ordinal: number, ruleId: string) => ({ group, ordinal, ruleId });

	it('counts ticket lines and the Plants they name', () => {
		const lines = new Map([
			['front-lawn', [line('Ready now', 1, 'a'), line('Ready now', 2, 'b')]],
			['esperanza-1', [line('Ready now', 3, 'c')]],
		]);
		expect(weekLine('2026-09-26', lines)).toBe('Plan for Sep 26 · 3 lines on this week\'s ticket, for 2 Plants');
	});

	it('uses the singular for one of each', () => {
		expect(weekLine('2026-09-26', new Map([['fig-1', [line('Held back', 1, 'a')]]]))).toBe('Plan for Sep 26 · 1 line on this week\'s ticket, for 1 Plant');
	});

	it('says so when the ticket names no Plant', () => {
		expect(weekLine('2026-09-26', new Map())).toBe('Plan for Sep 26 · Nothing on this week\'s ticket names a Plant');
	});
});
