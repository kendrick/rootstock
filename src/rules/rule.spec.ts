import { describe, expect, it } from 'vitest';
import {
	appliesToSchema,
	cadenceRuleSchema,
	guardConditionSchema,
	guardRuleSchema,
	productLabelSchema,
	ruleSchema,
	sourceSchema,
	tagPolicySchema,
	thresholdRuleSchema,
	windowRuleSchema,
} from './rule';

const northTexas = { name: 'Denton, TX', hardinessZone: '8a' };

const agriLife = {
	kind: 'extension',
	label: 'Texas A&M AgriLife Extension',
	url: 'https://agrilifeextension.tamu.edu/',
};

const ownerPractice = { kind: 'owner', label: 'Yard notes', url: null };

const wholeYard = { plantIds: null, plantTags: null, ruleTags: null };

const prodiamineLabel = { url: 'https://labels.example.com/prodiamine-65-wdg.pdf' };

const bifenthrinLabel = { url: 'https://labels.example.com/bifenthrin-7-9.pdf' };

const fallPreEmergent = {
	id: 'fall-pre-emergent',
	name: 'Fall pre-emergent',
	kind: 'window',
	region: northTexas,
	source: agriLife,
	tags: ['lawn', 'chemical', 'pre-emergent'],
	delegable: false,
	priority: 10,
	appliesTo: { ...wholeYard, plantTags: ['turf'] },
	productLabel: prodiamineLabel,
	start: '09-10',
	end: '09-25',
};

const lastNitrogen = {
	id: 'last-nitrogen',
	name: 'Last nitrogen of the year',
	kind: 'window',
	region: northTexas,
	source: agriLife,
	tags: ['lawn', 'fertilizer'],
	delegable: true,
	priority: 20,
	appliesTo: { ...wholeYard, plantTags: ['turf'] },
	productLabel: null,
	start: '10-01',
	end: '10-15',
};

const springPreEmergent = {
	id: 'spring-pre-emergent',
	name: 'Spring pre-emergent',
	kind: 'threshold',
	region: northTexas,
	source: agriLife,
	tags: ['lawn', 'chemical', 'pre-emergent'],
	delegable: false,
	priority: 10,
	appliesTo: { ...wholeYard, plantTags: ['turf'] },
	productLabel: prodiamineLabel,
	variable: 'soil-temperature',
	depthCm: 6,
	aggregate: 'mean',
	comparison: 'gte',
	value: 55,
	unit: 'F',
	consecutiveDays: 3,
	published: { low: 50, high: 55, source: agriLife },
};

const springPreEmergentSecond = {
	id: 'spring-pre-emergent-second',
	name: 'Spring pre-emergent, second application',
	kind: 'cadence',
	region: northTexas,
	source: agriLife,
	tags: ['lawn', 'chemical', 'pre-emergent'],
	delegable: false,
	priority: 11,
	appliesTo: { ...wholeYard, plantTags: ['turf'] },
	productLabel: prodiamineLabel,
	everyDays: { min: 42, max: 56 },
	season: null,
	after: { ruleId: 'spring-pre-emergent' },
};

const esperanzaFeeding = {
	id: 'esperanza-feeding',
	name: 'Feed the Esperanza',
	kind: 'cadence',
	region: northTexas,
	source: ownerPractice,
	tags: ['fertilizer', 'container'],
	delegable: true,
	priority: 40,
	appliesTo: { ...wholeYard, plantIds: ['esperanza-1'] },
	productLabel: null,
	everyDays: { min: 28, max: 42 },
	season: { start: '03-15', end: '10-05' },
	after: null,
};

const figNoFertilizerUntilSpring = {
	id: 'fig-no-fertilizer-until-spring',
	name: 'No fig fertilizer outside spring',
	kind: 'guard',
	region: northTexas,
	source: ownerPractice,
	tags: ['fertilizer'],
	delegable: true,
	priority: 5,
	appliesTo: { ...wholeYard, plantIds: ['fig-1'] },
	productLabel: null,
	condition: { kind: 'within-window', start: '03-01', end: '08-15', negate: true },
	effect: 'defer',
	release: 'Held until 03-01. Feeding a dormant fig pushes growth a freeze will take.',
};

const insecticideNeverBeforeRain = {
	id: 'insecticide-never-before-rain',
	name: 'No insecticide before rain',
	kind: 'guard',
	region: northTexas,
	source: agriLife,
	tags: ['chemical', 'pest'],
	delegable: false,
	priority: 1,
	appliesTo: { ...wholeYard, ruleTags: ['pest'] },
	productLabel: bifenthrinLabel,
	condition: { kind: 'no-rain-within', days: 2, probabilityAtLeast: 40 },
	effect: 'defer',
	release: 'Held until two dry days are forecast. Rain washes the application off before it works.',
};

describe('sourceSchema', () => {
	it('parses a published extension source', () => {
		expect(sourceSchema.parse(agriLife)).toEqual(agriLife);
	});

	it('defaults a missing url to null rather than dropping the key', () => {
		expect(sourceSchema.parse({ kind: 'owner', label: 'Yard notes' }).url).toBeNull();
	});

	it('rejects a source kind outside the pair', () => {
		expect(() => sourceSchema.parse({ kind: 'blog', label: 'Somebody', url: null })).toThrow();
	});
});

describe('productLabelSchema', () => {
	it('parses a label url', () => {
		expect(productLabelSchema.parse(prodiamineLabel)).toEqual(prodiamineLabel);
	});

	it('rejects transcribed instructions alongside the url', () => {
		expect(() => productLabelSchema.parse({ url: prodiamineLabel.url, rate: '1.5 lb per 1000 sq ft' })).toThrow();
	});
});

describe('appliesToSchema', () => {
	it('defaults every selector to null, meaning the whole yard', () => {
		expect(appliesToSchema.parse({})).toEqual(wholeYard);
	});

	it('rejects a plant id that is not lowercase kebab', () => {
		expect(() => appliesToSchema.parse({ plantIds: ['Esperanza_1'] })).toThrow();
	});
});

describe('tagPolicySchema', () => {
	it('parses the tag lists that narrow delegability', () => {
		const policy = { neverDelegableTags: ['chemical'], safetyTags: ['chemical', 'pest'] };
		expect(tagPolicySchema.parse(policy)).toEqual(policy);
	});
});

describe('guardConditionSchema', () => {
	it('parses a standing condition with no reading behind it', () => {
		expect(guardConditionSchema.parse({ kind: 'always' })).toEqual({ kind: 'always' });
	});

	it('rejects a rain probability above 100', () => {
		expect(() => guardConditionSchema.parse({ kind: 'no-rain-within', days: 2, probabilityAtLeast: 140 })).toThrow();
	});

	it('rejects an unknown condition kind', () => {
		expect(() => guardConditionSchema.parse({ kind: 'wind-below', speed: 10 })).toThrow();
	});
});

describe('ruleSchema seed rules', () => {
	it('parses the fall pre-emergent window', () => {
		const rule = ruleSchema.parse(fallPreEmergent);
		expect(rule.kind).toBe('window');
		expect(rule).toEqual(fallPreEmergent);
	});

	it('parses the last-nitrogen window with no product label', () => {
		const rule = ruleSchema.parse(lastNitrogen);
		expect(rule.productLabel).toBeNull();
	});

	it('parses the spring pre-emergent threshold with its published range', () => {
		const rule = thresholdRuleSchema.parse(springPreEmergent);
		expect(rule.consecutiveDays).toBe(3);
		expect(rule.published).toEqual({ low: 50, high: 55, source: agriLife });
	});

	it('parses the second application as a cadence chained to the first', () => {
		const rule = cadenceRuleSchema.parse(springPreEmergentSecond);
		expect(rule.after).toEqual({ ruleId: 'spring-pre-emergent' });
		expect(rule.everyDays).toEqual({ min: 42, max: 56 });
	});

	it('parses the Esperanza cadence fenced to a season', () => {
		const rule = cadenceRuleSchema.parse(esperanzaFeeding);
		expect(rule.season).toEqual({ start: '03-15', end: '10-05' });
		expect(rule.after).toBeNull();
	});

	it('parses the fig guard as a negated window deferral', () => {
		const rule = ruleSchema.parse(figNoFertilizerUntilSpring);
		expect(rule.kind).toBe('guard');
		expect(rule).toEqual(figNoFertilizerUntilSpring);
	});

	it('parses the insecticide guard as a rain deferral', () => {
		const rule = guardRuleSchema.parse(insecticideNeverBeforeRain);
		expect(rule.condition).toEqual({ kind: 'no-rain-within', days: 2, probabilityAtLeast: 40 });
		expect(rule.effect).toBe('defer');
	});

	it('defaults the nullable fields a hand-authored rule may leave out', () => {
		const rule = thresholdRuleSchema.parse({
			id: 'soil-probe-check',
			name: 'Check the soil probe',
			kind: 'threshold',
			region: northTexas,
			source: ownerPractice,
			tags: ['lawn'],
			delegable: true,
			priority: 50,
			appliesTo: {},
			variable: 'soil-temperature',
			aggregate: 'mean',
			comparison: 'lte',
			value: 40,
			unit: 'F',
			consecutiveDays: 1,
		});

		expect(rule.productLabel).toBeNull();
		expect(rule.depthCm).toBeNull();
		expect(rule.published).toBeNull();
		expect(rule.appliesTo).toEqual(wholeYard);
		expect(rule.direction).toBeNull();
		expect(rule.season).toBeNull();
	});
});

describe('delegable', () => {
	it('rejects a rule that never answered the delegability question', () => {
		const { delegable: _delegable, ...unanswered } = fallPreEmergent;
		expect(() => ruleSchema.parse(unanswered)).toThrow();
	});

	it('rejects null as an answer, since a required field is what fails closed', () => {
		expect(() => ruleSchema.parse({ ...fallPreEmergent, delegable: null })).toThrow();
	});
});

describe('chemical rules cite a product label', () => {
	it('rejects a chemical window rule with no label', () => {
		expect(() => ruleSchema.parse({ ...fallPreEmergent, productLabel: null })).toThrow(/must carry a productLabel/);
	});

	it('rejects a chemical threshold rule with no label', () => {
		expect(() => thresholdRuleSchema.parse({ ...springPreEmergent, productLabel: null })).toThrow(/must carry a productLabel/);
	});

	it('rejects a chemical cadence rule with no label', () => {
		expect(() => cadenceRuleSchema.parse({ ...springPreEmergentSecond, productLabel: null })).toThrow(/must carry a productLabel/);
	});

	it('rejects a chemical guard with no label', () => {
		expect(() => guardRuleSchema.parse({ ...insecticideNeverBeforeRain, productLabel: null })).toThrow(/must carry a productLabel/);
	});

	it('accepts a non-chemical rule with no label', () => {
		expect(ruleSchema.parse(lastNitrogen).productLabel).toBeNull();
	});
});

describe('cadence interval', () => {
	it('rejects a max shorter than its min', () => {
		expect(() =>
			cadenceRuleSchema.parse({ ...esperanzaFeeding, everyDays: { min: 42, max: 28 } }),
		).toThrow(/everyDays.max must not be less than everyDays.min/);
	});

	it('accepts a min and max that are equal', () => {
		const rule = cadenceRuleSchema.parse({ ...esperanzaFeeding, everyDays: { min: 30, max: 30 } });
		expect(rule.everyDays).toEqual({ min: 30, max: 30 });
	});

	it('rejects an interval of zero days', () => {
		expect(() =>
			cadenceRuleSchema.parse({ ...esperanzaFeeding, everyDays: { min: 0, max: 42 } }),
		).toThrow();
	});
});

describe('published range', () => {
	it('rejects a low above its high', () => {
		expect(() =>
			thresholdRuleSchema.parse({
				...springPreEmergent,
				published: { low: 55, high: 50, source: agriLife },
			}),
		).toThrow(/published.low must not exceed published.high/);
	});

	it('accepts a single published figure expressed as an equal low and high', () => {
		const rule = thresholdRuleSchema.parse({
			...springPreEmergent,
			published: { low: 55, high: 55, source: agriLife },
		});
		expect(rule.published).toEqual({ low: 55, high: 55, source: agriLife });
	});
});

describe('consecutiveDays', () => {
	// ADR 0003 says to widen the artifact's observation window when a rule
	// reaches past it, not to shorten the rule. Hence no upper bound.
	it('accepts a run longer than the shipped observation window', () => {
		const rule = thresholdRuleSchema.parse({ ...springPreEmergent, consecutiveDays: 45 });
		expect(rule.consecutiveDays).toBe(45);
	});

	it('rejects a run of zero days', () => {
		expect(() => thresholdRuleSchema.parse({ ...springPreEmergent, consecutiveDays: 0 })).toThrow();
	});
});

describe('direction and season', () => {
	it('accepts direction: rising paired with comparison: gte', () => {
		const rule = thresholdRuleSchema.parse({ ...springPreEmergent, direction: 'rising' });
		expect(rule.direction).toBe('rising');
	});

	it('accepts direction: falling paired with comparison: lte', () => {
		const rule = thresholdRuleSchema.parse({ ...springPreEmergent, comparison: 'lte', direction: 'falling' });
		expect(rule.direction).toBe('falling');
	});

	it('rejects a direction outside the pair', () => {
		expect(() => thresholdRuleSchema.parse({ ...springPreEmergent, direction: 'sideways' })).toThrow();
	});

	it('rejects rising paired with comparison: lte', () => {
		expect(() =>
			thresholdRuleSchema.parse({ ...springPreEmergent, comparison: 'lte', direction: 'rising' }),
		).toThrow(/must pair with comparison/);
	});

	it('rejects falling paired with comparison: gte', () => {
		expect(() =>
			thresholdRuleSchema.parse({ ...springPreEmergent, direction: 'falling' }),
		).toThrow(/must pair with comparison/);
	});

	it('parses a season in the same shape as a cadence rule\'s season', () => {
		const rule = thresholdRuleSchema.parse({ ...springPreEmergent, season: { start: '03-01', end: '06-01' } });
		expect(rule.season).toEqual({ start: '03-01', end: '06-01' });
	});

	it('rejects a season missing its end', () => {
		expect(() =>
			thresholdRuleSchema.parse({ ...springPreEmergent, season: { start: '03-01' } }),
		).toThrow();
	});
});

describe('guard annotate and defer do not mix', () => {
	const { release: _release, ...figGuardBase } = figNoFertilizerUntilSpring;

	const figAnnotate = {
		...figGuardBase,
		id: 'fig-dormancy-note',
		effect: 'annotate',
		text: 'The fig is dormant; skip the nitrogen and check the mulch instead.',
	};

	it('parses an annotate guard carrying text', () => {
		const rule = guardRuleSchema.parse(figAnnotate);
		expect(rule.effect).toBe('annotate');
	});

	it('rejects an annotate guard carrying a release', () => {
		expect(() => guardRuleSchema.parse({ ...figAnnotate, release: 'Held until 03-01.' })).toThrow();
	});

	it('rejects a defer guard carrying annotation text', () => {
		expect(() =>
			guardRuleSchema.parse({ ...figNoFertilizerUntilSpring, text: 'The fig is dormant.' }),
		).toThrow();
	});

	it('rejects a defer guard with no release, since a guard owes the interface an until', () => {
		expect(() => guardRuleSchema.parse({ ...figGuardBase, effect: 'defer' })).toThrow();
	});

	it('rejects an effect outside the pair', () => {
		expect(() => guardRuleSchema.parse({ ...figGuardBase, effect: 'remove' })).toThrow();
	});
});

describe('authoring mistakes in hand-written JSON', () => {
	it('rejects an unknown key rather than ignoring it', () => {
		expect(() => ruleSchema.parse({ ...fallPreEmergent, notes: 'bagged product only' })).toThrow();
	});

	it('rejects a full ISO date where a recurring MM-DD belongs', () => {
		expect(() => ruleSchema.parse({ ...fallPreEmergent, start: '2026-09-10' })).toThrow();
	});

	it('rejects an id that is not lowercase kebab', () => {
		expect(() => ruleSchema.parse({ ...fallPreEmergent, id: 'Fall_PreEmergent' })).toThrow();
	});

	it('rejects a fractional priority', () => {
		expect(() => ruleSchema.parse({ ...fallPreEmergent, priority: 10.5 })).toThrow();
	});

	it('rejects a rule kind nobody defined', () => {
		expect(() => ruleSchema.parse({ ...fallPreEmergent, kind: 'reminder' })).toThrow();
	});

	it('rejects a label url that is not a url', () => {
		expect(() => windowRuleSchema.parse({ ...fallPreEmergent, productLabel: { url: 'see the bag' } })).toThrow();
	});
});
