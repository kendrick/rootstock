import { describe, expect, it } from 'vitest';
import { aggregateSchema, observationSchema, unitSchema, variableSchema } from './observation';

const soilReading = {
	observedAt: '2026-09-11T14:00:00.000Z',
	variable: 'soil-temperature',
	depthCm: 10,
	value: 68.4,
	unit: 'F',
	basis: 'observed',
	provenance: 'measured',
	source: 'manual',
	station: 'backyard-probe',
} satisfies Record<string, unknown>;

const precipitationReading = {
	observedAt: '2026-09-11T14:00:00.000Z',
	variable: 'precipitation',
	depthCm: null,
	value: 2.5,
	unit: 'mm',
	basis: 'forecast',
	provenance: 'modeled',
	source: 'open-meteo',
	station: null,
} satisfies Record<string, unknown>;

describe('variableSchema', () => {
	it('parses every known series', () => {
		expect(variableSchema.parse('soil-temperature')).toBe('soil-temperature');
		expect(variableSchema.parse('precipitation')).toBe('precipitation');
		expect(variableSchema.parse('precipitation-probability')).toBe('precipitation-probability');
	});

	it('rejects an unknown series', () => {
		expect(() => variableSchema.parse('wind-speed')).toThrow();
	});
});

describe('unitSchema', () => {
	it('parses every known unit', () => {
		expect(unitSchema.parse('F')).toBe('F');
		expect(unitSchema.parse('mm')).toBe('mm');
		expect(unitSchema.parse('percent')).toBe('percent');
	});

	it('rejects an unknown unit', () => {
		expect(() => unitSchema.parse('celsius')).toThrow();
	});
});

describe('aggregateSchema', () => {
	it('parses every known reducer', () => {
		expect(aggregateSchema.parse('mean')).toBe('mean');
		expect(aggregateSchema.parse('min')).toBe('min');
		expect(aggregateSchema.parse('max')).toBe('max');
		expect(aggregateSchema.parse('sum')).toBe('sum');
	});

	it('rejects an unknown reducer', () => {
		expect(() => aggregateSchema.parse('median')).toThrow();
	});
});

describe('observationSchema', () => {
	it('parses a measured soil reading with a depth and a station', () => {
		const parsed = observationSchema.parse(soilReading);
		expect(parsed).toEqual(soilReading);
	});

	it('parses a modeled precipitation reading with depth and station absent as null', () => {
		const parsed = observationSchema.parse(precipitationReading);
		expect(parsed).toEqual(precipitationReading);
	});

	it('rejects an unknown variable', () => {
		expect(() => observationSchema.parse({ ...soilReading, variable: 'wind-speed' })).toThrow();
	});

	it('rejects an unknown unit', () => {
		expect(() => observationSchema.parse({ ...soilReading, unit: 'celsius' })).toThrow();
	});

	it('rejects an unknown basis', () => {
		expect(() => observationSchema.parse({ ...soilReading, basis: 'projected' })).toThrow();
	});

	it('rejects an unknown provenance', () => {
		expect(() => observationSchema.parse({ ...soilReading, provenance: 'estimated' })).toThrow();
	});

	it('rejects an unknown source', () => {
		expect(() => observationSchema.parse({ ...soilReading, source: 'noaa' })).toThrow();
	});

	it('rejects a missing depthCm rather than defaulting it', () => {
		const { depthCm: _depthCm, ...withoutDepth } = soilReading;
		expect(() => observationSchema.parse(withoutDepth)).toThrow();
	});

	it('rejects a missing station rather than defaulting it', () => {
		const { station: _station, ...withoutStation } = soilReading;
		expect(() => observationSchema.parse(withoutStation)).toThrow();
	});

	it('rejects an unknown extra property', () => {
		expect(() => observationSchema.parse({ ...soilReading, elevationM: 210 })).toThrow();
	});
});
