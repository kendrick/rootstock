import type { GuardRule, Rule, ThresholdRule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAN_WINDOW_DAYS } from '@/planner/plan';
import {
	findCoordinateKeys,
	findCoordinatePairs,
	findDuplicateIds,
	findLongDecimals,
	findRulesPastWindow,
	findUnresolvedReferences,
	seedOccurrences,
	seedPlants,
	seedRules,
	seedTagPolicy,
	seedYard,
} from './index';
import { isStartOfFrame, jpegSegments, readFrameDimensions } from './photo';

const REGION = { name: 'Test County', hardinessZone: '8b' };
const OWNER_SOURCE = { kind: 'owner' as const, label: 'Test practice', url: null };
const WHOLE_YARD = { plantIds: null, plantTags: null, ruleTags: null };

function plant(overrides: Partial<Plant> = {}): Plant {
	return {
		id: 'test-plant',
		name: 'Test plant',
		kind: 'plant',
		status: 'planted',
		tags: [],
		position: null,
		site: null,
		lawn: null,
		notes: null,
		...overrides,
	};
}

function thresholdRule(overrides: Partial<ThresholdRule> = {}): ThresholdRule {
	return {
		id: 'test-threshold',
		kind: 'threshold',
		name: 'Test threshold',
		region: REGION,
		source: OWNER_SOURCE,
		tags: [],
		delegable: true,
		priority: 0,
		appliesTo: WHOLE_YARD,
		productLabel: null,
		variable: 'soil-temperature',
		depthCm: 6,
		aggregate: 'mean',
		comparison: 'gte',
		value: 55,
		unit: 'F',
		consecutiveDays: 3,
		direction: null,
		season: null,
		published: null,
		...overrides,
	};
}

function guardRule(overrides: Partial<GuardRule> = {}): GuardRule {
	return {
		id: 'test-guard',
		kind: 'guard',
		name: 'Test guard',
		region: REGION,
		source: OWNER_SOURCE,
		tags: [],
		delegable: true,
		priority: 0,
		appliesTo: WHOLE_YARD,
		productLabel: null,
		condition: { kind: 'always' },
		effect: 'annotate',
		text: 'Test annotation',
		...overrides,
	} as GuardRule;
}

describe('seed loading', () => {
	// A malformed seed file throws at import time (parseWith's job), so
	// reaching these assertions at all is already proof the five files parsed.
	it('exposes the seed inventory, rule set, and tag policy', () => {
		expect(seedYard.id).toBe('home-yard');
		expect(seedPlants.length).toBeGreaterThan(0);
		expect(seedRules.length).toBeGreaterThan(0);
		expect(seedOccurrences).toEqual([]);
		expect(seedTagPolicy.neverDelegableTags).toContain('chemical');
	});
});

describe('id uniqueness across plants, rules, and occurrences', () => {
	it('finds no duplicate id in the real seed data', () => {
		expect(findDuplicateIds(seedPlants, seedRules, seedOccurrences)).toEqual([]);
	});

	// A check that cannot fail is worse than no check: proves the detector
	// catches an id reused ACROSS lists, not only within one of them.
	it('reports a rule id that collides with a plant id', () => {
		const plants = [plant({ id: 'shared-id' })];
		const rules = [thresholdRule({ id: 'shared-id' })];

		expect(findDuplicateIds(plants, rules, [])).toEqual(['shared-id']);
	});
});

describe('reference resolution', () => {
	it('resolves every appliesTo.plantIds and after.ruleId in the real seed data', () => {
		expect(findUnresolvedReferences(seedPlants, seedRules, seedOccurrences)).toEqual([]);
	});

	it('reports a rule whose appliesTo.plantIds names a plant that does not exist', () => {
		const rules = [thresholdRule({ appliesTo: { ...WHOLE_YARD, plantIds: ['no-such-plant'] } })];

		expect(findUnresolvedReferences([], rules, [])).toEqual([
			'rule \'test-threshold\' appliesTo.plantIds names unknown plant \'no-such-plant\'',
		]);
	});

	it('reports a cadence rule whose after.ruleId names a rule that does not exist', () => {
		const rules: Rule[] = [{
			id: 'test-cadence',
			kind: 'cadence',
			name: 'Test cadence',
			region: REGION,
			source: OWNER_SOURCE,
			tags: [],
			delegable: true,
			priority: 0,
			appliesTo: WHOLE_YARD,
			productLabel: null,
			everyDays: { min: 28, max: 42 },
			season: null,
			after: { ruleId: 'no-such-rule' },
		}];

		expect(findUnresolvedReferences([], rules, [])).toEqual([
			'rule \'test-cadence\' after.ruleId names unknown rule \'no-such-rule\'',
		]);
	});

	it('reports an occurrence whose ruleId or plantId names something that does not exist', () => {
		const occurrences = [{
			id: 'test-occurrence',
			ruleId: 'no-such-rule',
			plantId: 'no-such-plant',
			completedAt: '2026-09-01T12:00:00Z',
			recordedAt: '2026-09-01T12:00:00Z',
			source: 'browser' as const,
		}];

		expect(findUnresolvedReferences([], [], occurrences)).toEqual([
			'occurrence \'test-occurrence\' ruleId names unknown rule \'no-such-rule\'',
			'occurrence \'test-occurrence\' plantId names unknown plant \'no-such-plant\'',
		]);
	});
});

describe('window reach (ADR 0003)', () => {
	it('keeps every threshold consecutiveDays and no-rain-within days within PLAN_WINDOW_DAYS in the real seed data', () => {
		expect(findRulesPastWindow(seedRules, PLAN_WINDOW_DAYS)).toEqual([]);
	});

	it('reports a threshold rule whose consecutiveDays reaches past the window', () => {
		const rules = [thresholdRule({ id: 'reaches-too-far', consecutiveDays: PLAN_WINDOW_DAYS + 1 })];

		expect(findRulesPastWindow(rules, PLAN_WINDOW_DAYS)).toEqual([
			`threshold rule 'reaches-too-far' needs ${PLAN_WINDOW_DAYS + 1} consecutive days, past the ${PLAN_WINDOW_DAYS}-day window`,
		]);
	});

	it('reports a no-rain-within guard whose days reaches past the window', () => {
		const rules = [guardRule({
			id: 'waits-too-long',
			condition: { kind: 'no-rain-within', days: PLAN_WINDOW_DAYS + 5, probabilityAtLeast: 50 },
			effect: 'annotate',
			text: 'irrelevant',
		})];

		expect(findRulesPastWindow(rules, PLAN_WINDOW_DAYS)).toEqual([
			`guard rule 'waits-too-long' no-rain-within needs ${PLAN_WINDOW_DAYS + 5} days, past the ${PLAN_WINDOW_DAYS}-day window`,
		]);
	});

	it('does not flag a window or cadence rule, which read no lookback', () => {
		const cadence: Rule = {
			id: 'test-cadence',
			kind: 'cadence',
			name: 'Test cadence',
			region: REGION,
			source: OWNER_SOURCE,
			tags: [],
			delegable: true,
			priority: 0,
			appliesTo: WHOLE_YARD,
			productLabel: null,
			everyDays: { min: PLAN_WINDOW_DAYS + 10, max: PLAN_WINDOW_DAYS + 20 },
			season: null,
			after: null,
		};

		expect(findRulesPastWindow([cadence], PLAN_WINDOW_DAYS)).toEqual([]);
	});
});

describe('value-level coordinate check (ADR 0004)', () => {
	const seedFiles = ['yard.json', 'plants.json', 'rules.json', 'occurrences.json', 'tag-policy.json'];

	for (const file of seedFiles) {
		const text = readFileSync(join(import.meta.dirname, file), 'utf-8');

		it(`${file} carries no number with three or more decimal places`, () => {
			expect(findLongDecimals(text)).toEqual([]);
		});

		it(`${file} carries no key that reads like a coordinate`, () => {
			expect(findCoordinateKeys(text)).toEqual([]);
		});

		it(`${file} carries no coordinate pair inside a string`, () => {
			expect(findCoordinatePairs(text)).toEqual([]);
		});
	}

	// A check that cannot fail is worse than no check: proves the detectors
	// actually flag bad input rather than passing because nothing was tested.
	it('reports a number with three or more decimal places', () => {
		expect(findLongDecimals('{"value": 32.73577}')).toEqual(['32.73577']);
	});

	it('does not mistake an ordinary decimal, or a number embedded in a URL string, for a coordinate', () => {
		const text = '{"value": 0.61, "url": "https://example.com/labels/SCP%201139A-L10C%200121.pdf"}';

		expect(findLongDecimals(text)).toEqual([]);
	});

	it('reports a key that reads like a coordinate', () => {
		expect(findCoordinateKeys('{"lat": 1, "longitude": 2, "name": "fine"}')).toEqual(['lat', 'longitude']);
	});

	// The leak a hand-authored seed file is likeliest to spring: someone pastes
	// a pin out of a maps app into a free-text field, where no schema and no
	// bare-number scan can see it.
	it('reports a coordinate pair pasted into a free-text string', () => {
		expect(findCoordinatePairs('{"notes": "32.7357, -97.1081"}')).toEqual(['32.7357, -97.1081']);
	});

	it('does not mistake a product-label URL or a version string for a coordinate pair', () => {
		const text = '{"url": "https://example.com/SCP%201139A-L10C%200121.pdf", "v": "1.2.3, 4.5.6"}';

		expect(findCoordinatePairs(text)).toEqual([]);
	});
});

describe('yard.json to public/yard.jpg dimension cross-check', () => {
	it('matches the committed photo\'s SOF dimensions to seedYard.photo', () => {
		expect(seedYard.photo, 'expected the seed yard to carry a photo record').not.toBeNull();
		const photo = seedYard.photo!;

		const path = join(import.meta.dirname, '..', '..', 'public', 'yard.jpg');
		const bytes = readFileSync(path);
		const sof = jpegSegments(bytes).find(segment => isStartOfFrame(segment.marker));
		expect(sof, 'expected a SOF segment in the committed photo').toBeDefined();

		const { width, height } = readFrameDimensions(bytes, sof!);

		expect(width).toBe(photo.width);
		expect(height).toBe(photo.height);
	});
});
