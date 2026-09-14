import { z } from 'zod';
import { kebabIdSchema } from '@/validation/ids';

/**
 * An Occurrence is an append-only record that work happened. Marking a task
 * done writes a NEW Occurrence rather than mutating an old one, which is what
 * lets cadence rules read the most recent matching one and gives the yard a
 * history nobody had to design separately. Its `(ruleId, plantId)` pair is
 * the same key a Task is identified by.
 *
 * A Rule and a Plant are named by string ID alone here, never by a type borrowed from the module that owns either one, which is what keeps `src/rules/` and `src/yard/` out of this module's import graph and out of a cycle with it. Its one project-local import, `@/validation/ids`, carries the id character class and no domain type.
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
