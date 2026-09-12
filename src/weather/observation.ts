import { z } from 'zod';

/**
 * The series a reading belongs to. Kept closed (rather than a free string) so a
 * Threshold Rule can pattern-match on it exhaustively: adding a new series is a
 * schema change, not a typo waiting to slip past validation.
 */
export const variableSchema = z.enum(['soil-temperature', 'precipitation', 'precipitation-probability']);
export type Variable = z.infer<typeof variableSchema>;

/**
 * The unit a value is expressed in. One enum per project rather than per
 * Variable because a Rule reads `unit` alongside `value` without needing to
 * infer it from `variable` first.
 */
export const unitSchema = z.enum(['F', 'mm', 'percent']);
export type Unit = z.infer<typeof unitSchema>;

/**
 * How the Planner collapses a run of hourly Observations into one daily
 * figure. Lives here because it is a small closed vocabulary the
 * rules and the Planner both read, but the daily figure itself — the aggregate value — is the Planner's
 * type, not this module's.
 */
export const aggregateSchema = z.enum(['mean', 'min', 'max', 'sum']);
export type Aggregate = z.infer<typeof aggregateSchema>;

/**
 * One hourly reading at one moment — never a daily figure. Daily aggregation
 * reduces many Observations to one number and belongs to the Planner, which
 * decides mean vs. min vs. sum per Rule; baking that choice in here would
 * throw away the hourly readings a different Rule might need aggregated a
 * different way.
 *
 * `basis` separates a reading already recorded (`observed`) from one still
 * predicted (`forecast`) — this is what lets a Threshold Rule refuse to fire
 * on forecast data, since CONTEXT.md requires it read observed days only.
 *
 * `provenance` separates a modeled grid-cell estimate (`modeled`) from an
 * actual probe reading (`measured`) — this is what stops a modeled value from
 * ever being displayed as a measurement, regardless of how confident the
 * model providing it is.
 *
 * `source` is an enum rather than free text so the Planner can prefer a
 * manual probe reading over a modeled one by comparing a fixed set of values,
 * not by string-matching an open-ended provider name.
 *
 * `depthCm` and `station` are `.nullable()`, not `.optional()`: a soil
 * reading has both, a precipitation reading has neither, and the parsed type
 * has to say which.
 *
 * No `.default(null)` here, unlike Plant, Rule and Occurrence. Those are
 * hand-authored JSON where letting a seed file omit a key is worth the
 * asymmetry between what is written and what is parsed. An Observation is
 * machine-produced, so every key is present on the way in as well as out.
 */
export const observationSchema = z.strictObject({
	observedAt: z.iso.datetime(),
	variable: variableSchema,
	depthCm: z.number().nullable(),
	value: z.number(),
	unit: unitSchema,
	basis: z.enum(['observed', 'forecast']),
	provenance: z.enum(['modeled', 'measured']),
	source: z.enum(['open-meteo', 'manual']),
	station: z.string().nullable(),
});
export type Observation = z.infer<typeof observationSchema>;
