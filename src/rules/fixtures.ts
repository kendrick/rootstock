import type { ThresholdRule } from './rule';
import { thresholdRuleSchema } from './rule';

/**
 * A directed soil-temperature Threshold Rule, in the shape the seed's `spring-pre-emergent` had until #48 made that Rule a Window Rule. The seed carries no Threshold Rule since then, so specs exercising Threshold behavior (the Crossing, the season fence, the published range) read this one instead of narrowing the seed. Parsed rather than typed, so it stays a Rule the schema accepts.
 */
export const soilThresholdRule: ThresholdRule = thresholdRuleSchema.parse({
	id: 'soil-threshold-pre-emergent',
	kind: 'threshold',
	name: 'Spring pre-emergent by soil temperature',
	region: { name: 'Southwest Fort Worth, Texas', hardinessZone: '8b' },
	variable: 'soil-temperature',
	depthCm: 6,
	aggregate: 'mean',
	comparison: 'gte',
	value: 55,
	unit: 'F',
	consecutiveDays: 3,
	direction: 'rising',
	season: { start: '02-01', end: '04-30' },
	published: {
		low: 50,
		high: 55,
		source: {
			kind: 'extension',
			label: 'Texas A&M AgriLife Extension',
			url: 'https://www.dcmga.com/wp-content/uploads/docs/agrilife/grasses/al-herbicide-selection-warm-searson-turfgrass.pdf',
		},
	},
	tags: ['lawn', 'herbicide', 'chemical'],
	productLabel: { url: 'https://assets.greencastonline.com/pdf/labels/SCP%201139A-L10C%200121.pdf' },
	source: { kind: 'extension', label: 'Texas A&M AgriLife Extension', url: 'https://agrilifetoday.tamu.edu/2016/02/24/its-crabgrass-time-again/' },
	delegable: false,
	priority: 10,
	appliesTo: { plantIds: ['front-lawn'], plantTags: null, ruleTags: null },
});
