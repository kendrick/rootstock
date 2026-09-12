import type { OrderableTask } from './order';
import type { Task } from './task';
import type { TagPolicy } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { orderTasks } from './order';
import { taskId, taskSchema } from './task';

/**
 * A Task carries several fields this suite never varies (citation, status,
 * delegable, title). Building one through `taskSchema.parse` rather than a
 * cast keeps every fixture honest against the schema's own refine on `id`,
 * which is the thing `taskId` and this helper both have to agree on.
 */
function task(options: { ruleId: string; plantId?: string | null; tags?: string[] }): Task {
	const plantId = options.plantId ?? null;
	return taskSchema.parse({
		id: taskId(options.ruleId, plantId),
		ruleId: options.ruleId,
		plantId,
		status: 'fired',
		citation: { kind: 'window', date: '2026-09-01' },
		deferrals: [],
		annotations: [],
		delegable: true,
		tags: options.tags ?? [],
		title: `Task for ${options.ruleId}`,
	});
}

function entry(options: {
	ruleId: string;
	plantId?: string | null;
	tags?: string[];
	specificity: 1 | 2 | 3;
	priority: number;
}): OrderableTask {
	return {
		task: task({ ruleId: options.ruleId, plantId: options.plantId, tags: options.tags }),
		specificity: options.specificity,
		priority: options.priority,
	};
}

const noSafetyTags: TagPolicy = { neverDelegableTags: [], safetyTags: [] };
const chemicalIsSafety: TagPolicy = { neverDelegableTags: [], safetyTags: ['chemical'] };

describe('orderTasks', () => {
	it('returns an empty array for empty input', () => {
		expect(orderTasks([], noSafetyTags)).toEqual([]);
	});

	it('does not mutate the entries argument', () => {
		const entries = [
			entry({ ruleId: 'b', specificity: 1, priority: 0 }),
			entry({ ruleId: 'a', specificity: 1, priority: 0 }),
		];
		const before = [...entries];

		orderTasks(entries, noSafetyTags);

		expect(entries).toEqual(before);
	});

	it('leaves every Task non-safety when safetyTags is empty', () => {
		// Both entries carry 'chemical', which would decide the order under a
		// policy that treated it as a safety tag. An empty safetyTags list must
		// fall straight through to specificity instead of matching nothing.
		const entries = [
			entry({ ruleId: 'a', tags: ['chemical'], specificity: 1, priority: 0 }),
			entry({ ruleId: 'b', tags: ['chemical'], specificity: 3, priority: 0 }),
		];

		const result = orderTasks(entries, noSafetyTags);

		expect(result.map(item => item.ruleId)).toEqual(['b', 'a']);
	});

	// Tier 1 (safety): the pair ties on ruleId, plantId, specificity, and
	// priority, and differs only in whether a tag appears in safetyTags.
	it('tier 1: sorts a safety Task ahead of a tied non-safety Task', () => {
		const entries = [
			entry({ ruleId: 'shared', plantId: 'p', tags: [], specificity: 2, priority: 5 }),
			entry({ ruleId: 'shared', plantId: 'p', tags: ['chemical'], specificity: 2, priority: 5 }),
		];

		const result = orderTasks(entries, chemicalIsSafety);

		expect(result.map(item => item.tags)).toEqual([['chemical'], []]);
	});

	// Tier 2 (specificity): the pair ties on safety standing (both
	// non-safety, since safetyTags is empty), priority, ruleId, and plantId,
	// and differs only in specificity. The two entries share a ruleId and
	// plantId, so the tags are used purely as a label to tell the two Tasks
	// apart in the output — with no safetyTags to match against, they play
	// no part in the comparison itself.
	it('tier 2: sorts higher specificity ahead of a tied lower one', () => {
		const entries = [
			entry({ ruleId: 'shared', plantId: 'p', tags: ['low'], specificity: 1, priority: 5 }),
			entry({ ruleId: 'shared', plantId: 'p', tags: ['high'], specificity: 3, priority: 5 }),
		];

		const result = orderTasks(entries, noSafetyTags);

		expect(result.map(item => item.tags)).toEqual([['high'], ['low']]);
	});

	// Tier 3 (priority): the pair ties on safety standing, specificity,
	// ruleId, and plantId, and differs only in priority; tags again serve
	// only as a label, since an empty safetyTags list keeps them out of the
	// comparison.
	it('tier 3: sorts lower priority ahead of a tied higher one', () => {
		const entries = [
			entry({ ruleId: 'shared', plantId: 'p', tags: ['low'], specificity: 2, priority: 20 }),
			entry({ ruleId: 'shared', plantId: 'p', tags: ['high'], specificity: 2, priority: 3 }),
		];

		const result = orderTasks(entries, noSafetyTags);

		expect(result.map(item => item.tags)).toEqual([['high'], ['low']]);
	});

	it('lets a negative priority lead', () => {
		const entries = [
			entry({ ruleId: 'ordinary', specificity: 2, priority: 5 }),
			entry({ ruleId: 'must-lead', specificity: 2, priority: -1 }),
		];

		const result = orderTasks(entries, noSafetyTags);

		expect(result.map(item => item.ruleId)).toEqual(['must-lead', 'ordinary']);
	});

	// Tier 4 (ruleId): the pair ties on safety standing, specificity,
	// priority, and plantId (both 'p'), and differs only in ruleId.
	it('tier 4: sorts the lexically earlier ruleId ahead of a tied later one', () => {
		const entries = [
			entry({ ruleId: 'zebra', plantId: 'p', specificity: 2, priority: 5 }),
			entry({ ruleId: 'apple', plantId: 'p', specificity: 2, priority: 5 }),
		];

		const result = orderTasks(entries, noSafetyTags);

		expect(result.map(item => item.ruleId)).toEqual(['apple', 'zebra']);
	});

	// Tier 5 (plantId): the pair ties on safety standing, specificity,
	// priority, and ruleId, and differs only in plantId — one Rule that
	// produced a whole-yard Task and a named-plant Task, with the null one
	// sorting last.
	it('tier 5: sorts a null plantId after a non-null one from the same Rule', () => {
		const entries = [
			entry({ ruleId: 'shared', plantId: null, specificity: 2, priority: 5 }),
			entry({ ruleId: 'shared', plantId: 'fig-1', specificity: 2, priority: 5 }),
		];

		const result = orderTasks(entries, noSafetyTags);

		expect(result.map(item => item.plantId)).toEqual(['fig-1', null]);
	});

	it('tier 5: sorts the lexically earlier non-null plantId ahead of a tied later one', () => {
		const entries = [
			entry({ ruleId: 'shared', plantId: 'zebra-plant', specificity: 2, priority: 5 }),
			entry({ ruleId: 'shared', plantId: 'apple-plant', specificity: 2, priority: 5 }),
		];

		const result = orderTasks(entries, noSafetyTags);

		expect(result.map(item => item.plantId)).toEqual(['apple-plant', 'zebra-plant']);
	});

	it('sorts a low-specificity safety Task ahead of a high-specificity non-safety one', () => {
		// Safety outranks every later tier, specificity included, so this pair
		// deliberately differs on both to prove tier 1 alone decides it.
		const entries = [
			entry({ ruleId: 'chemical-but-broad', tags: ['chemical'], specificity: 1, priority: 50 }),
			entry({ ruleId: 'plain-but-narrow', tags: [], specificity: 3, priority: -50 }),
		];

		const result = orderTasks(entries, chemicalIsSafety);

		expect(result.map(item => item.ruleId)).toEqual(['chemical-but-broad', 'plain-but-narrow']);
	});

	it('produces the same order regardless of input order', () => {
		const entries = [
			entry({ ruleId: 'safety-work', tags: ['chemical'], specificity: 1, priority: 10 }),
			entry({ ruleId: 'broad-yard-rule', specificity: 1, priority: 40 }),
			entry({ ruleId: 'named-plant-rule', plantId: 'fig-1', specificity: 3, priority: 12 }),
			entry({ ruleId: 'named-plant-rule', plantId: null, specificity: 3, priority: 12 }),
			entry({ ruleId: 'tag-targeted-rule', plantId: 'esperanza-1', specificity: 2, priority: -5 }),
			entry({ ruleId: 'tag-targeted-rule', plantId: 'front-lawn', specificity: 2, priority: -5 }),
		];
		const reversed = [...entries].reverse();

		const forward = orderTasks(entries, chemicalIsSafety);
		const backward = orderTasks(reversed, chemicalIsSafety);

		const expectedIds = [
			'safety-work',
			'named-plant-rule@fig-1',
			'named-plant-rule',
			'tag-targeted-rule@esperanza-1',
			'tag-targeted-rule@front-lawn',
			'broad-yard-rule',
		];
		expect(forward.map(item => item.id)).toEqual(expectedIds);
		expect(backward.map(item => item.id)).toEqual(expectedIds);
	});
});
