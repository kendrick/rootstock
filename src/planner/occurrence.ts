import { z } from 'zod';

const kebabIdSchema = z.string().regex(/^[a-z0-9-]+$/);

/**
 * An Occurrence is an append-only record that work happened. Marking a task
 * done writes a NEW Occurrence rather than mutating an old one, which is what
 * lets cadence rules read the most recent matching one and gives the yard a
 * history nobody had to design separately. Its `(ruleId, plantId)` pair is
 * the same key a Task is identified by.
 *
 * This module is deliberately dependency-free: rule and plant are referenced
 * by string ID only, so it never imports from `src/rules/`, `src/weather/`,
 * or anywhere else in the project.
 */
export const occurrenceSchema = z.strictObject({
	id: kebabIdSchema,
	ruleId: kebabIdSchema,
	plantId: kebabIdSchema.nullable().default(null),
	completedAt: z.iso.datetime(),
	// When the record was written; differs from completedAt when backfilling.
	recordedAt: z.iso.datetime(),
	source: z.enum(['seed', 'browser']),
});

export type Occurrence = z.infer<typeof occurrenceSchema>;
