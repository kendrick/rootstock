import { describe, expect, it } from 'vitest';
import { citationSchema, taskId, taskIdSchema, taskSchema } from './task';

const windowCitation = { kind: 'window', date: '2026-09-01' } as const;

function fixture(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: taskId('pre-emergent-fall', 'front-bed'),
		ruleId: 'pre-emergent-fall',
		plantId: 'front-bed',
		status: 'fired',
		citation: windowCitation,
		deferrals: [],
		annotations: [],
		delegable: true,
		tags: ['lawn'],
		title: 'Apply fall pre-emergent to the front bed.',
		...overrides,
	};
}

describe('taskId', () => {
	it('joins ruleId and plantId with \'@\'', () => {
		expect(taskId('water-tomatoes-weekly', 'tomato-1')).toBe('water-tomatoes-weekly@tomato-1');
	});

	it('returns the bare ruleId when plantId is null', () => {
		expect(taskId('prune-roses-spring', null)).toBe('prune-roses-spring');
	});
});

describe('taskIdSchema', () => {
	it('parses a bare rule id', () => {
		expect(taskIdSchema.parse('prune-roses-spring')).toBe('prune-roses-spring');
	});

	it('parses a rule id joined to a plant id', () => {
		expect(taskIdSchema.parse('water-tomatoes-weekly@tomato-1')).toBe('water-tomatoes-weekly@tomato-1');
	});

	it('rejects more than one \'@\' join', () => {
		expect(() => taskIdSchema.parse('rule@plant@extra')).toThrow();
	});

	it('rejects an uppercase segment', () => {
		expect(() => taskIdSchema.parse('Rule@plant')).toThrow();
	});
});

describe('citationSchema', () => {
	it('parses a window citation', () => {
		expect(citationSchema.parse(windowCitation)).toEqual(windowCitation);
	});

	it('parses a threshold citation with a null depth', () => {
		const fixtureCitation = {
			kind: 'threshold',
			variable: 'precipitation',
			depthCm: null,
			aggregate: 'sum',
			from: '2026-08-01',
			to: '2026-08-03',
		};
		expect(citationSchema.parse(fixtureCitation)).toEqual(fixtureCitation);
	});

	it('parses a threshold-projection citation', () => {
		const fixtureCitation = {
			kind: 'threshold-projection',
			variable: 'soil-temperature',
			depthCm: 6,
			aggregate: 'mean',
			projectedDate: '2026-09-20',
		};
		expect(citationSchema.parse(fixtureCitation)).toEqual(fixtureCitation);
	});

	it('parses a cadence citation with no prior occurrence', () => {
		const fixtureCitation = {
			kind: 'cadence',
			lastOccurrenceId: null,
			elapsedDays: null,
		};
		expect(citationSchema.parse(fixtureCitation)).toEqual(fixtureCitation);
	});

	it('rejects an unknown kind', () => {
		expect(() => citationSchema.parse({ kind: 'trigger', date: '2026-09-01' })).toThrow();
	});
});

describe('taskSchema', () => {
	it('parses a well-formed fired task', () => {
		const input = fixture();
		expect(taskSchema.parse(input)).toEqual(input);
	});

	it('parses a well-formed deferred task', () => {
		const input = fixture({
			status: 'deferred',
			deferrals: [{ guardId: 'no-spray-before-rain', releaseWhen: 'no rain forecast within 24h' }],
		});
		expect(taskSchema.parse(input)).toEqual(input);
	});

	it('rejects an id that disagrees with ruleId and plantId', () => {
		const input = fixture({ id: 'some-other-id' });
		expect(() => taskSchema.parse(input)).toThrow();
	});

	it('rejects an id computed for the wrong plantId', () => {
		const input = fixture({ id: taskId('pre-emergent-fall', 'back-bed') });
		expect(() => taskSchema.parse(input)).toThrow();
	});

	it('rejects status \'deferred\' with no deferrals', () => {
		const input = fixture({ status: 'deferred', deferrals: [] });
		expect(() => taskSchema.parse(input)).toThrow();
	});

	it('rejects a non-deferred status carrying a deferral', () => {
		const input = fixture({
			status: 'fired',
			deferrals: [{ guardId: 'no-spray-before-rain', releaseWhen: 'no rain forecast within 24h' }],
		});
		expect(() => taskSchema.parse(input)).toThrow();
	});

	it('rejects an unknown status', () => {
		const input = fixture({ status: 'done' });
		expect(() => taskSchema.parse(input)).toThrow();
	});

	it('rejects unknown keys', () => {
		const input = { ...fixture(), extra: 'nope' };
		expect(() => taskSchema.parse(input)).toThrow();
	});
});
