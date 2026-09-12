import type { Plan } from './plan';
import type { Citation } from './task';
import { z } from 'zod';
import { ruleSchema, tagPolicySchema } from '@/rules/rule';
import { observationSchema } from '@/weather/observation';
import { plantSchema } from '@/yard/plant';
import { occurrenceSchema } from './occurrence';

/**
 * An IANA zone name, checked by handing it to `Intl` instead of matching a
 * pattern. `America/Chicago` and `Amerika/Chicago` are the same shape, and the
 * typo would bucket every Observation into the wrong day while reading fine in
 * a seed file.
 */
const timeZoneSchema = z.string().refine(
	(value) => {
		try {
			return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone.length > 0;
		}
		catch {
			return false;
		}
	},
	{ message: 'must be an IANA time zone name, such as \'America/Chicago\'' },
);

/**
 * Everything the Planner is given for one date. It reads no clock and makes no
 * network call, so the date it plans for arrives here as an argument alongside
 * the yard it plans over, which is what lets a spec plan any day of any year
 * without moving the machine's calendar.
 *
 * `timeZone` is here because `observations` carry UTC instants and Rules are
 * written about local days. Without the zone there is no local day to bucket
 * an hourly Observation into, and a September evening in Texas lands on
 * tomorrow's date if the Planner guesses UTC.
 *
 * `observations` are hourly. The Planner owns the reduction to a daily figure
 * because the choice between a mean, a min and a sum belongs to the Rule
 * reading it, and nothing upstream knows which Rule that will be.
 *
 * This is a parser rather than a type alias because it runs against a
 * generation run's real inputs, where the seed files are hand-authored JSON.
 * The composed schemas do the work: a Rule is validated here by the same
 * schema that validates it anywhere else, so this file cannot drift into a
 * second opinion about what a Rule is.
 */
export const planInputSchema = z.strictObject({
	asOf: z.iso.date(),
	timeZone: timeZoneSchema,
	plants: z.array(plantSchema),
	rules: z.array(ruleSchema),
	observations: z.array(observationSchema),
	occurrences: z.array(occurrenceSchema),
	tagPolicy: tagPolicySchema,
});

export type PlanInput = z.infer<typeof planInputSchema>;

/**
 * What one Rule concluded about one Plant on the planned date.
 *
 * A Rule module returns this rather than a Task because ADR 0001 gives the
 * Planner sole authority to author one: a Task carries an id derived from the
 * pair it belongs to, a delegability already narrowed by tag policy, and a
 * title in the house voice, and none of those are facts a Rule knows on its
 * own. So each module answers the one question it can answer—did this fire, on
 * what evidence—and the Planner turns that answer into work.
 *
 * The split also keeps the Guard pass honest. A Guard runs over Tasks after
 * they exist, and a Rule module that had already produced a finished Task
 * would leave nothing for the Planner to hold back.
 *
 * `titleSuffix` carries the mechanical clause a Cadence Rule appends to a
 * title—'overdue', 'never recorded'—and is null for the Rule kinds that have
 * nothing to add. The Planner writes the title and the model writes the
 * sentences, so the suffix is the one fragment a Rule contributes to the
 * mechanical wording.
 */
export type RuleVerdict
	= | { fires: false }
		| {
			fires: true;
			status: 'fired' | 'approaching';
			citation: Citation;
			titleSuffix: string | null;
		};

/**
 * Turns one day's inputs into the Plan for that date.
 *
 * Not implemented yet. The signature and the input contract land ahead of the
 * body so the Rule modules and their specs can be written against them.
 * Throwing is what keeps a half-built Planner from publishing an empty Plan,
 * which reads exactly like a yard with nothing to do.
 */
export function plan(_input: PlanInput): Plan {
	throw new Error('plan() is not implemented yet');
}
