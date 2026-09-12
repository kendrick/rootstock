import { describe, expect, it } from 'vitest';
import { occurrenceSchema } from './occurrence';

describe('occurrenceSchema', () => {
	it('parses a well-formed fixture', () => {
		const fixture = {
			id: 'occ-001',
			ruleId: 'water-tomatoes-weekly',
			plantId: 'tomato-1',
			completedAt: '2026-09-11T14:30:00Z',
			recordedAt: '2026-09-11T18:00:00Z',
			source: 'browser',
		};

		const result = occurrenceSchema.parse(fixture);
		expect(result).toEqual(fixture);
	});

	it('defaults plantId to null when absent', () => {
		const fixture = {
			id: 'occ-002',
			ruleId: 'prune-roses-spring',
			completedAt: '2026-09-11T14:30:00Z',
			recordedAt: '2026-09-11T14:30:00Z',
			source: 'seed',
		};

		const result = occurrenceSchema.parse(fixture);
		expect(result.plantId).toBeNull();
	});

	it('accepts an explicit null plantId', () => {
		const fixture = {
			id: 'occ-003',
			ruleId: 'prune-roses-spring',
			plantId: null,
			completedAt: '2026-09-11T14:30:00Z',
			recordedAt: '2026-09-11T14:30:00Z',
			source: 'seed',
		};

		expect(() => occurrenceSchema.parse(fixture)).not.toThrow();
	});

	it('rejects an unknown source', () => {
		const fixture = {
			id: 'occ-004',
			ruleId: 'water-tomatoes-weekly',
			plantId: 'tomato-1',
			completedAt: '2026-09-11T14:30:00Z',
			recordedAt: '2026-09-11T14:30:00Z',
			source: 'manual-app',
		};

		expect(() => occurrenceSchema.parse(fixture)).toThrow();
	});

	it('rejects a non-kebab id', () => {
		const fixture = {
			id: 'Occ_001',
			ruleId: 'water-tomatoes-weekly',
			plantId: 'tomato-1',
			completedAt: '2026-09-11T14:30:00Z',
			recordedAt: '2026-09-11T14:30:00Z',
			source: 'browser',
		};

		expect(() => occurrenceSchema.parse(fixture)).toThrow();
	});

	it('rejects unknown keys', () => {
		const fixture = {
			id: 'occ-005',
			ruleId: 'water-tomatoes-weekly',
			plantId: 'tomato-1',
			completedAt: '2026-09-11T14:30:00Z',
			recordedAt: '2026-09-11T14:30:00Z',
			source: 'browser',
			extra: 'nope',
		};

		expect(() => occurrenceSchema.parse(fixture)).toThrow();
	});
});
