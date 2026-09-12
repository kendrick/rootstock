import { z } from 'zod';
import { aggregateSchema, variableSchema } from '@/weather/observation';

/**
 * A lowercase-kebab identifier, shared by every entity id this module
 * refers to. Defined locally rather than imported: this module speaks only
 * to `@/weather/observation`, so a Rule or Plant id is just a string shape
 * here, never a type borrowed from the module that owns it.
 */
const kebabIdSchema = z.string().regex(/^[a-z0-9-]+$/);

/**
 * A Task's id is derived, never authored, so the Planner, the store, and the
 * interface all land on the same string without coordinating. `@` is the
 * separator because `-` is legal inside a kebab id on either side and would
 * make the join ambiguous; `@` never appears in a kebab id, so splitting is
 * unambiguous too.
 *
 * The id deliberately carries no date. A Plan already states its own `asOf`,
 * and a date-free id is what lets a checked-off task survive a page reload
 * and lets two days' plans be diffed against each other.
 */
export function taskId(ruleId: string, plantId: string | null): string {
	return plantId === null ? ruleId : `${ruleId}@${plantId}`;
}

/** Matches exactly what {@link taskId} produces: a kebab rule id, optionally `@`-joined to a kebab plant id. */
export const taskIdSchema = z.string().regex(/^[a-z0-9-]+(@[a-z0-9-]+)?$/);
export type TaskId = z.infer<typeof taskIdSchema>;

/**
 * What fired a Task, one variant per Rule kind that can produce one. A
 * Citation is checked by membership against the real Rule set upstream of
 * this schema; here it only has to carry enough of the reading to render a
 * sentence and a sparkline mark.
 *
 * `threshold` cites the observed run that already satisfied the Rule.
 * `threshold-projection` is the sibling case: the observed run is still
 * short, but continuing the current trend crosses the Rule's value on
 * `projectedDate`, so the Task shows as `approaching` rather than `fired`.
 * `cadence` carries the elapsed-days figure rather than requiring a reader
 * to compute one from a raw Occurrence timestamp, and it is nullable
 * because a Rule with no prior Occurrence still fires today.
 */
export const citationSchema = z.discriminatedUnion('kind', [
	z.strictObject({
		kind: z.literal('window'),
		date: z.iso.date(),
	}),
	z.strictObject({
		kind: z.literal('threshold'),
		variable: variableSchema,
		depthCm: z.number().nullable(),
		aggregate: aggregateSchema,
		from: z.iso.date(),
		to: z.iso.date(),
	}),
	z.strictObject({
		kind: z.literal('threshold-projection'),
		variable: variableSchema,
		depthCm: z.number().nullable(),
		aggregate: aggregateSchema,
		projectedDate: z.iso.date(),
	}),
	z.strictObject({
		kind: z.literal('cadence'),
		lastOccurrenceId: z.string().nullable(),
		elapsedDays: z.number().nullable(),
	}),
]);
export type Citation = z.infer<typeof citationSchema>;

/**
 * Records that a Guard held a Task back, and what would release it. ADR
 * 0002 requires both halves to travel together: a Guard that could defer
 * without saying `releaseWhen` would leave the interface unable to render
 * anything past "not now".
 */
export const deferralSchema = z.strictObject({
	guardId: kebabIdSchema,
	releaseWhen: z.string(),
});
export type Deferral = z.infer<typeof deferralSchema>;

/**
 * A note a Guard attached to a Task without deferring it — the Guard ran,
 * had something to say, but did not hold the work back.
 */
export const annotationSchema = z.strictObject({
	guardId: kebabIdSchema,
	text: z.string(),
});
export type Annotation = z.infer<typeof annotationSchema>;

/**
 * One piece of work the Planner derived from exactly one Rule. `ruleId` and
 * `plantId` are the same pair an Occurrence is keyed by, but they are
 * carried as plain strings rather than a reference to `@/rules/`, because
 * this module is not allowed to know that package exists — a Task can be
 * validated and rendered long before the Rule that produced it loads.
 *
 * `title` is the mechanical sentence the Planner writes for every Task,
 * whether or not Narration ever runs over the Plan — it is not a fallback
 * for a missing model pass, it is the thing the interface renders by
 * default.
 *
 * The two refines below are the load-bearing part of this schema. See ADR
 * 0002 for why a deferred Task keeps its citation instead of disappearing,
 * and why `deferred` is a status computed by the Planner rather than a
 * filter applied at render time.
 */
export const taskSchema = z.strictObject({
	id: taskIdSchema,
	ruleId: kebabIdSchema,
	plantId: kebabIdSchema.nullable(),
	status: z.enum(['fired', 'approaching', 'deferred']),
	citation: citationSchema,
	deferrals: z.array(deferralSchema),
	annotations: z.array(annotationSchema),
	delegable: z.boolean(),
	tags: z.array(z.string()),
	title: z.string(),
}).refine(
	task => task.id === taskId(task.ruleId, task.plantId),
	{ message: 'id must equal taskId(ruleId, plantId)', path: ['id'] },
).refine(
	task => (task.status === 'deferred') === (task.deferrals.length > 0),
	{ message: 'status must be \'deferred\' if and only if deferrals is non-empty', path: ['status'] },
);
export type Task = z.infer<typeof taskSchema>;
