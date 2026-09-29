import type { Plan } from '@/planner/plan';
import { describe, expect, it } from 'vitest';
import { taskId } from '@/planner/task';
import { drawnBands } from './bands';
import { cadenceRule, guardRule, windowRule } from './fixtures';
import { rankRules } from './waiting';

const quiet: Plan = { asOf: '2026-09-14', tasks: [], window: [] };

describe('drawnBands', () => {
	// The index lists what the page draws, so an empty band has no entry.
	it('leaves out a band with no Rule in it', () => {
		expect(drawnBands(rankRules([cadenceRule, guardRule], quiet)).map(band => band.label)).toEqual(['Waiting', 'Guards']);
	});

	it('keeps the page\'s order whatever order the Rules arrive in', () => {
		const plan: Plan = {
			...quiet,
			tasks: [{
				id: taskId(windowRule.id, null),
				ruleId: windowRule.id,
				plantId: null,
				status: 'fired',
				citation: { kind: 'window', date: '2026-09-14' },
				deferrals: [],
				annotations: [],
				delegable: false,
				tags: [],
				title: 'Fired',
				guardChecks: null,
			}],
		};

		expect(drawnBands(rankRules([guardRule, cadenceRule, windowRule], plan)).map(band => band.label)).toEqual(['Fired this week', 'Waiting', 'Guards']);
	});
});
