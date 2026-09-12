import { z } from 'zod';
import { aggregateSchema, unitSchema, variableSchema } from '@/weather/observation';
import { taskSchema } from './task';

/**
 * How many trailing days of DailyAggregate the Planner carries in a Plan's
 * `window`, per rule field, regardless of how far back any one Rule reads.
 *
 * ADR 0003 fixes the direction of travel on purpose: a Rule that needs more
 * history than this is a reason to raise this constant, not a reason to cap
 * a Rule's own lookback. Nothing here enforces that a Rule stays inside the
 * window — the fix for a Rule that reaches past it is to widen the window.
 */
export const PLAN_WINDOW_DAYS = 30;

/**
 * One local calendar day of one variable at one depth, reduced from many
 * hourly Observations by the Planner. It is a different type from
 * `Observation` on purpose: an Observation is one reading at one moment, and
 * collapsing a day's worth of them into a mean, min, max, or sum is a
 * Planner decision a Rule makes per its own needs, not a fact the weather
 * layer could bake in once.
 *
 * `Plan.window` is a run of these, and the soil-temperature sparkline is
 * drawn off them — `basis` is what lets that sparkline show the forecast
 * days as forecast rather than pretending the whole run was observed.
 */
export const dailyAggregateSchema = z.strictObject({
	date: z.iso.date(),
	variable: variableSchema,
	depthCm: z.number().nullable(),
	aggregate: aggregateSchema,
	value: z.number(),
	unit: unitSchema,
	basis: z.enum(['observed', 'forecast']),
	provenance: z.enum(['modeled', 'measured']),
	source: z.enum(['open-meteo', 'manual']),
});
export type DailyAggregate = z.infer<typeof dailyAggregateSchema>;

/**
 * What the Planner returns for one date: every Task it derived (including
 * the deferred ones — see ADR 0002) and the window of DailyAggregates the Rules
 * evaluated to produce them. The window travels with the Plan rather than
 * being reassembled downstream, because only the Planner run that produced
 * this Plan knows which days those were.
 *
 * Task ids are unique within a Plan by refine below: two Tasks sharing an
 * id would collide the moment either one is checked off, since check-off
 * is keyed by id alone.
 */
export const planSchema = z.strictObject({
	asOf: z.iso.date(),
	tasks: z.array(taskSchema),
	window: z.array(dailyAggregateSchema),
}).refine(
	(plan) => {
		const ids = plan.tasks.map(task => task.id);
		return new Set(ids).size === ids.length;
	},
	{ message: 'task ids must be unique within a Plan', path: ['tasks'] },
);
export type Plan = z.infer<typeof planSchema>;
