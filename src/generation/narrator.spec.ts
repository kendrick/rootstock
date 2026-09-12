import type { Narration } from '@/artifact/narration';
import type { Plan } from '@/planner/plan';
import type { Task } from '@/planner/task';
import { describe, expect, it } from 'vitest';
import { taskId } from '@/planner/task';
import { fakeNarrator, validateNarration } from './narrator';

// Hand-built rather than pulled from a fixtures module: every assertion below turns on which ids
// are in the Plan and which are in the Narration, so the two sets are worth reading side by side in
// this file instead of being inherited from somewhere else.
function plannedTask(ruleId: string, plantId: string | null): Task {
	return {
		id: taskId(ruleId, plantId),
		ruleId,
		plantId,
		status: 'fired',
		citation: { kind: 'window', date: '2026-09-12' },
		deferrals: [],
		annotations: [],
		delegable: true,
		tags: [],
		title: `Do ${ruleId}.`,
	};
}

const plan: Plan = {
	asOf: '2026-09-12',
	tasks: [
		plannedTask('pre-emergent', 'front-lawn'),
		plannedTask('deep-water', 'fig-1'),
		plannedTask('sharpen-blade', null),
	],
	window: [],
};

function narration(taskIds: string[]): Narration {
	return {
		summary: 'A cool, wet week in the yard.',
		tasks: taskIds.map(id => ({ taskId: id, text: `Something about ${id}.` })),
		advisories: [],
	};
}

describe('validateNarration', () => {
	it('accepts a narration naming only some of the plan\'s tasks', () => {
		// The load-bearing case. ADR 0001 lets the model select, so leaving a Task out is an
		// editorial decision, not a fabrication—the omitted Task is still in the Plan and still
		// renders with the title the Planner wrote.
		expect(() => validateNarration(narration(['pre-emergent@front-lawn', 'deep-water@fig-1']), plan)).not.toThrow();
	});

	it('accepts a narration that names no tasks at all', () => {
		expect(() => validateNarration(narration([]), plan)).not.toThrow();
	});

	it('accepts every planned task, in an order the plan did not use', () => {
		const reordered = narration(['sharpen-blade', 'pre-emergent@front-lawn', 'deep-water@fig-1']);

		expect(() => validateNarration(reordered, plan)).not.toThrow();
	});

	it('rejects a task id the plan does not contain, naming it in the message', () => {
		expect(() => validateNarration(narration(['overseed@back-lawn']), plan))
			.toThrow(/overseed@back-lawn/);
	});

	it('rejects with a full sentence naming the label, the path and the plan date', () => {
		expect(() => validateNarration(narration(['overseed@back-lawn']), plan)).toThrow(
			'narration: tasks[0].taskId names a task the plan for 2026-09-12 does not contain, but received "overseed@back-lawn".',
		);
	});

	it('points at the offending entry rather than the first one when a valid id precedes it', () => {
		expect(() => validateNarration(narration(['deep-water@fig-1', 'invented']), plan))
			.toThrow('narration: tasks[1].taskId names a task the plan for 2026-09-12 does not contain, but received "invented".');
	});

	it('rejects a real rule id that names no task in this plan', () => {
		// A Rule fires for many Plants, so `deep-water` alone is a real rule id and still not a
		// task id the Planner ever wrote. Keying the check on the task id is what catches it.
		expect(() => validateNarration(narration(['deep-water']), plan)).toThrow(/deep-water/);
	});

	it('does not hold advisories against the plan', () => {
		// An Advisory carries no Citation by definition, so there is nothing about one to check.
		const withAdvisories: Narration = {
			...narration(['sharpen-blade']),
			advisories: [{ text: 'The crape myrtle is dropping leaves early.' }],
		};

		expect(() => validateNarration(withAdvisories, plan)).not.toThrow();
	});

	it('accepts any narration against a plan with no tasks, so long as it names none', () => {
		const emptyPlan: Plan = { asOf: '2026-09-12', tasks: [], window: [] };

		expect(() => validateNarration(narration([]), emptyPlan)).not.toThrow();
		expect(() => validateNarration(narration(['sharpen-blade']), emptyPlan)).toThrow(/sharpen-blade/);
	});
});

describe('fakeNarrator', () => {
	it('resolves with exactly the narration it was configured with', async () => {
		const configured = narration(['pre-emergent@front-lawn']);

		await expect(fakeNarrator(configured)(plan)).resolves.toBe(configured);
	});

	it('rejects with the same error instance it was configured with', async () => {
		const failure = new Error('the model timed out');

		await expect(fakeNarrator(failure)(plan)).rejects.toBe(failure);
	});

	it('preserves an error subclass rather than flattening it to Error', async () => {
		class NarratorTimeout extends Error {
			constructor(readonly seconds: number) {
				super(`gave up after ${seconds}s`);
			}
		}
		const failure = new NarratorTimeout(90);

		await expect(fakeNarrator(failure)(plan)).rejects.toBeInstanceOf(NarratorTimeout);
	});

	it('ignores the plan it is handed', async () => {
		const configured = narration(['sharpen-blade']);
		const narrator = fakeNarrator(configured);
		const otherPlan: Plan = { asOf: '2019-01-01', tasks: [], window: [] };

		await expect(narrator(otherPlan)).resolves.toBe(configured);
	});
});
