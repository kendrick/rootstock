import { describe, expect, it } from 'vitest';
import { dailyAggregateSchema, PLAN_WINDOW_DAYS, planSchema } from './plan';
import { taskId } from './task';

const dailyAggregateFixture = {
	date: '2026-09-01',
	variable: 'soil-temperature',
	depthCm: 6,
	aggregate: 'mean',
	value: 68.4,
	unit: 'F',
	basis: 'observed',
	provenance: 'modeled',
	source: 'open-meteo',
};

function taskFixture(ruleId: string, plantId: string | null) {
	return {
		id: taskId(ruleId, plantId),
		ruleId,
		plantId,
		status: 'fired' as const,
		citation: { kind: 'window' as const, date: '2026-09-01' },
		deferrals: [],
		annotations: [],
		delegable: true,
		tags: [],
		title: 'Do the thing.',
	};
}

describe('the plan window constant', () => {
	it('is a positive integer', () => {
		expect(Number.isInteger(PLAN_WINDOW_DAYS)).toBe(true);
		expect(PLAN_WINDOW_DAYS).toBeGreaterThan(0);
	});
});

describe('dailyAggregateSchema', () => {
	it('parses a well-formed fixture', () => {
		expect(dailyAggregateSchema.parse(dailyAggregateFixture)).toEqual(dailyAggregateFixture);
	});

	it('parses a null depth for a depth-free variable', () => {
		const fixture = { ...dailyAggregateFixture, variable: 'precipitation', depthCm: null };
		expect(dailyAggregateSchema.parse(fixture)).toEqual(fixture);
	});

	it('rejects an unknown basis', () => {
		expect(() => dailyAggregateSchema.parse({ ...dailyAggregateFixture, basis: 'projected' })).toThrow();
	});

	it('rejects unknown keys', () => {
		expect(() => dailyAggregateSchema.parse({ ...dailyAggregateFixture, extra: 'nope' })).toThrow();
	});
});

describe('planSchema', () => {
	it('parses a well-formed plan', () => {
		const plan = {
			asOf: '2026-09-11',
			tasks: [taskFixture('pre-emergent-fall', 'front-bed'), taskFixture('prune-roses-spring', null)],
			window: [dailyAggregateFixture],
		};
		expect(planSchema.parse(plan)).toEqual(plan);
	});

	it('parses a plan with no tasks and an empty window', () => {
		const plan = { asOf: '2026-09-11', tasks: [], window: [] };
		expect(planSchema.parse(plan)).toEqual(plan);
	});

	it('rejects duplicate task ids within a plan', () => {
		const duplicate = taskFixture('pre-emergent-fall', 'front-bed');
		const plan = {
			asOf: '2026-09-11',
			tasks: [duplicate, { ...duplicate }],
			window: [],
		};
		expect(() => planSchema.parse(plan)).toThrow();
	});

	it('accepts the same ruleId across two distinct plantIds', () => {
		const plan = {
			asOf: '2026-09-11',
			tasks: [taskFixture('water-tomatoes-weekly', 'tomato-1'), taskFixture('water-tomatoes-weekly', 'tomato-2')],
			window: [],
		};
		expect(() => planSchema.parse(plan)).not.toThrow();
	});

	it('rejects unknown keys', () => {
		const plan = { asOf: '2026-09-11', tasks: [], window: [], extra: 'nope' };
		expect(() => planSchema.parse(plan)).toThrow();
	});
});
