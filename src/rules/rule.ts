import { z } from 'zod';
import { aggregateSchema, unitSchema, variableSchema } from '@/weather/observation';
import { regionSchema } from '@/yard/plant';

const kebabIdSchema = z.string().regex(/^[a-z0-9-]+$/);

/**
 * A date that recurs every year, written MM-DD. Deliberately not
 * `z.iso.date()`: a full date would pin the fall pre-emergent window to 2026,
 * and the window comes back every September.
 */
const monthDaySchema = z.string().regex(/^\d{2}-\d{2}$/);

/**
 * Where the rule came from. `kind` separates a published extension
 * recommendation from the owner's own practice. The two carry different weight
 * when somebody questions a rule a year later, and the rendered citation says
 * which one this is.
 */
export const sourceSchema = z.strictObject({
	kind: z.enum(['extension', 'owner']),
	label: z.string(),
	url: z.url().nullable().default(null),
});

export type Source = z.infer<typeof sourceSchema>;

/**
 * A link to the manufacturer's label for a product. This app never restates
 * mixing rates, re-entry intervals, or application steps: the label is the
 * legal instruction, and a paraphrase of it goes stale the day the formulation
 * changes. So the only field here is where to read it.
 */
export const productLabelSchema = z.strictObject({
	url: z.url(),
});

export type ProductLabel = z.infer<typeof productLabelSchema>;

/**
 * Which plants a rule targets. All three selectors default to null, meaning no
 * constraint on that selector—a rule with all three null applies to the whole
 * yard, which is what a lawn-wide pre-emergent wants.
 *
 * The three combine as OR inside a selector and AND across them: `plantIds`
 * and `plantTags` together choose the plants, and `ruleTags` narrows what they
 * chose. The reading being turned down is the whole-OR one, where any selector
 * matching is enough. Under it, a guard naming `plantIds: ['fig-1']` and
 * `ruleTags: ['fertilizer']` also reaches the lawn's last nitrogen of the
 * year, and September's lawn feeding arrives deferred by a guard written about
 * the fig.
 *
 * Null rather than an empty array: an empty array reads as "matches nothing",
 * so a hand-authored `[]` left behind by an edit would quietly disable the
 * rule instead of failing.
 */
export const appliesToSchema = z.strictObject({
	plantIds: z.array(kebabIdSchema).nullable().default(null),
	plantTags: z.array(z.string()).nullable().default(null),
	ruleTags: z.array(z.string()).nullable().default(null),
});

export type AppliesTo = z.infer<typeof appliesToSchema>;

/**
 * The tag that marks work involving a pesticide or herbicide.
 *
 * Fertilizer sits outside it deliberately. Seed data tags feeding work
 * `fertilizer` and leaves it delegable, so the household can be asked to feed
 * the Esperanza and never to spray anything.
 *
 * It is a constant rather than a loose string because two separate mechanisms
 * read it and they must agree: the authoring refine below, which requires such
 * a rule to cite a product label, and a TagPolicy's `neverDelegableTags`, which
 * keeps that work off the Away Card. TagPolicy chooses which tags carry which
 * consequence; it does not get to invent the tag's spelling.
 */
export const CHEMICAL_TAG = 'chemical';

/**
 * Tags that narrow delegability yard-wide. CONTEXT.md is explicit that tag
 * policy only narrows: a rule tagged `chemical` stays undelegable however its
 * own `delegable` field is set, and nothing here can widen a rule that already
 * said no.
 */
export const tagPolicySchema = z.strictObject({
	neverDelegableTags: z.array(z.string()),
	safetyTags: z.array(z.string()),
});

export type TagPolicy = z.infer<typeof tagPolicySchema>;

/**
 * The fields every rule kind carries, spread into each of the four rather than
 * composed with an intersection. An intersection hides the `kind` literal from
 * Zod's discriminated-union matcher, and losing the top-level discriminator
 * costs every parse failure its error path.
 *
 * `delegable` is a required boolean, with no default and no null. ADR 0002
 * argues the case: a required field fails closed, because nobody can author a
 * rule without answering the question. A view-layer filter fails open instead,
 * the first time somebody adds a rule and forgets the string match.
 *
 * `priority` sorts the plan, lower first. Signed, so a rule that must lead
 * takes a negative number instead of forcing a renumber.
 */
const ruleBaseShape = {
	id: kebabIdSchema,
	name: z.string(),
	region: regionSchema,
	source: sourceSchema,
	tags: z.array(z.string()),
	delegable: z.boolean(),
	priority: z.number().int(),
	appliesTo: appliesToSchema,
	productLabel: productLabelSchema.nullable().default(null),
};

// Applied to all five rule objects rather than once to `ruleSchema`, so each
// exported kind enforces the rule alone, however the parse reached it.
function citesProductLabelWhenChemical(rule: { tags: string[]; productLabel: ProductLabel | null }): boolean {
	return !rule.tags.includes(CHEMICAL_TAG) || rule.productLabel !== null;
}

const chemicalNeedsProductLabel = {
	message: 'a rule tagged \'chemical\' must carry a productLabel: chemical work points at the manufacturer\'s label',
	path: ['productLabel'],
};

/**
 * Fires while the planned date falls inside a calendar range: fall pre-emergent
 * in mid-September, the last nitrogen of the year in mid-October. No weather
 * reading enters it. These are the jobs whose timing the calendar already
 * settles.
 */
export const windowRuleSchema = z.strictObject({
	...ruleBaseShape,
	kind: z.literal('window'),
	start: monthDaySchema,
	end: monthDaySchema,
}).refine(citesProductLabelWhenChemical, chemicalNeedsProductLabel);

export type WindowRule = z.infer<typeof windowRuleSchema>;

/**
 * Fires when a series holds at or past a value for a run of consecutive days.
 * `published` carries the range the extension service actually printed,
 * alongside the single number this yard acts on. AgriLife says spring
 * pre-emergent goes down between 50 and 55F, and picking 55 out of that range
 * is a local judgment worth showing next to the source it narrowed.
 *
 * `consecutiveDays` has a lower bound and deliberately no upper one. Per ADR
 * 0003, widen the artifact's observation window when a rule reaches past it,
 * rather than shortening the rule. A `.max()` here would invert that and let
 * the payload budget overrule the agronomy.
 *
 * `direction` names which way the series has to move for the run to count.
 * `null` judges the run on its own. `'rising'` or `'falling'` ties itself to
 * `comparison` (enforced by the refine below) and requires the day just
 * before the run to sit on the far side of `value`, so a crossing is
 * evidenced rather than assumed—a run already past `value` before the window
 * opened proves no trend at all.
 *
 * `season` fences the reading to part of the year, the same shape as
 * `cadenceRuleSchema.season` above. A soil-temperature threshold with no
 * season fires on a freak January warm spell exactly as readily as an actual
 * spring one; season is what lets a rule restrict a crossing to the part of
 * the year it's agronomically meaningful.
 */
export const thresholdRuleSchema = z.strictObject({
	...ruleBaseShape,
	kind: z.literal('threshold'),
	variable: variableSchema,
	depthCm: z.number().nullable().default(null),
	aggregate: aggregateSchema,
	comparison: z.enum(['gte', 'lte']),
	value: z.number(),
	unit: unitSchema,
	consecutiveDays: z.number().int().min(1),
	direction: z.enum(['rising', 'falling']).nullable().default(null),
	season: z.strictObject({
		start: monthDaySchema,
		end: monthDaySchema,
	}).nullable().default(null),
	published: z.strictObject({
		low: z.number(),
		high: z.number(),
		source: sourceSchema,
	}).nullable().default(null),
})
	.refine(citesProductLabelWhenChemical, chemicalNeedsProductLabel)
	.refine(
		rule => rule.published === null || rule.published.low <= rule.published.high,
		{ message: 'published.low must not exceed published.high', path: ['published'] },
	)
	.refine(
		rule =>
			rule.direction === null
			|| (rule.direction === 'rising' && rule.comparison === 'gte')
			|| (rule.direction === 'falling' && rule.comparison === 'lte'),
		{
			message: 'direction \'rising\' must pair with comparison \'gte\', and \'falling\' with \'lte\': the other pairing is a run that could never open, since a prior day already on the far side of value would have satisfied the comparison itself',
			path: ['direction'],
		},
	);

export type ThresholdRule = z.infer<typeof thresholdRuleSchema>;

/**
 * The one place `+ 1` is written for a directed threshold rule's lookback.
 * A directed rule reads the calendar day immediately before the run, in
 * addition to the run itself, because that day is what proves the series
 * crossed from the far side of `value` instead of having sat past it all
 * along.
 */
export function thresholdLookbackDays(rule: ThresholdRule): number {
	return rule.consecutiveDays + (rule.direction === null ? 0 : 1);
}

/**
 * Fires when an interval has elapsed since the most recent Occurrence, or when
 * there is none to measure from. `everyDays` is a range rather than a number
 * because the real instruction is "feed every four to six weeks"—a single
 * number would nag early or go quiet late.
 *
 * `season` fences the cadence to part of the year. Esperanza gets fed on a
 * cycle that stops in early October, and without the fence the cadence would
 * cheerfully ask for a December feeding.
 *
 * `after` chains one rule to another by ID. That is how a rule says "the
 * second application, six to eight weeks after the first" without a second
 * calendar date that drifts away from the first every year.
 */
export const cadenceRuleSchema = z.strictObject({
	...ruleBaseShape,
	kind: z.literal('cadence'),
	everyDays: z.strictObject({
		min: z.number().int().min(1),
		max: z.number().int().min(1),
	}),
	season: z.strictObject({
		start: monthDaySchema,
		end: monthDaySchema,
	}).nullable().default(null),
	after: z.strictObject({
		ruleId: kebabIdSchema,
	}).nullable().default(null),
})
	.refine(citesProductLabelWhenChemical, chemicalNeedsProductLabel)
	.refine(
		rule => rule.everyDays.max >= rule.everyDays.min,
		{ message: 'everyDays.max must not be less than everyDays.min', path: ['everyDays'] },
	);

export type CadenceRule = z.infer<typeof cadenceRuleSchema>;

/**
 * What a guard watches for. `always` lets a guard hold work on a standing house
 * rule rather than a reading. `within-window` carries `negate` so one shape
 * covers both "only during" and "not until", which is what the fig needs: hold
 * fertilizer whenever the date falls outside spring.
 */
export const guardConditionSchema = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('always') }),
	z.strictObject({
		kind: z.literal('no-rain-within'),
		days: z.number().int().min(1),
		probabilityAtLeast: z.number().min(0).max(100),
	}),
	z.strictObject({
		kind: z.literal('within-window'),
		start: monthDaySchema,
		end: monthDaySchema,
		negate: z.boolean(),
	}),
]);

export type GuardCondition = z.infer<typeof guardConditionSchema>;

const guardAnnotateRuleSchema = z.strictObject({
	...ruleBaseShape,
	kind: z.literal('guard'),
	condition: guardConditionSchema,
	effect: z.literal('annotate'),
	text: z.string(),
}).refine(citesProductLabelWhenChemical, chemicalNeedsProductLabel);

const guardDeferRuleSchema = z.strictObject({
	...ruleBaseShape,
	kind: z.literal('guard'),
	condition: guardConditionSchema,
	effect: z.literal('defer'),
	release: z.string(),
}).refine(citesProductLabelWhenChemical, chemicalNeedsProductLabel);

/**
 * A rule that creates no work, only holds it back or marks it up. ADR 0002
 * gives a guard two effects and no third: it may defer a task or annotate one,
 * and it has no path to remove one.
 *
 * The two effects are a nested discriminated union rather than one object with
 * both fields nullable. `release`—the renderable sentence saying what would
 * un-defer the task—is meaningless on an annotation, and ADR 0002 makes it
 * mandatory on a deferral. As a union, an annotate rule carrying `release`
 * fails at parse time instead of rendering an empty "held until" line.
 *
 * The union discriminates on `effect` and nests inside the `kind` union rather
 * than sitting beside it, because Zod rejects two options that share a
 * discriminator value: both guard branches at the top level would be a
 * duplicate `kind: 'guard'`. The alternative, dropping the top-level
 * discriminator, costs every rule its parse error path.
 */
export const guardRuleSchema = z.discriminatedUnion('effect', [
	guardAnnotateRuleSchema,
	guardDeferRuleSchema,
]);

export type GuardRule = z.infer<typeof guardRuleSchema>;

/**
 * Any of the four rule kinds, discriminated on `kind`. Rules are hand-authored
 * JSON, so this parse is what stands between a typo and a plan that reads as
 * authoritative. Hence `z.strictObject` throughout: a misspelled key is a
 * rejection, never a key quietly ignored.
 */
export const ruleSchema = z.discriminatedUnion('kind', [
	windowRuleSchema,
	thresholdRuleSchema,
	cadenceRuleSchema,
	guardRuleSchema,
]);

export type Rule = z.infer<typeof ruleSchema>;
