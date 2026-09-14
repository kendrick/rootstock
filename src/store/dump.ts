import { z } from 'zod';
import { occurrenceSchema } from '@/planner/occurrence';
import { ruleSchema, tagPolicySchema } from '@/rules/rule';
import { kebabIdSchema } from '@/validation/ids';
import { parseWith } from '@/validation/parse';
import { plantSchema, yardSchema } from '@/yard/plant';

/*
 * `id` mirrors `record.id`, so the check is written once here rather than
 * five times below. It passes silently for a record with no id of its own,
 * which today is the single TagPolicy: that schema is frozen and has no id
 * field, so the store files it under a constant instead. See TAG_POLICY_ID.
 */
function mirrorsRecordId(envelope: { id: string; record: unknown }): boolean {
	const { record } = envelope;
	if (typeof record !== 'object' || record === null) {
		return true;
	}
	const recordId = (record as { id?: unknown }).id;
	return typeof recordId !== 'string' || recordId === envelope.id;
}

/**
 * Wraps one domain schema in the store's envelope.
 *
 * A factory rather than five hand-written objects, because five copies of the
 * same four fields drift: the day `source` gains a third value, four of them
 * get updated and the fifth is found by a user with a dump that will not
 * import. The generic keeps each collection's `record` typed as its own
 * domain record rather than collapsing to a union.
 */
export function envelopeSchema<T extends z.ZodType>(recordSchema: T) {
	// Widened to a plain ZodType before it goes in the object. Left generic, Zod
	// cannot decide whether `record` is an optional key until T is known, and the
	// refine below is then typed against a shape where every field might be
	// absent.
	const record = recordSchema as z.ZodType<z.output<T>, z.input<T>>;

	return z.strictObject({
		id: kebabIdSchema,
		updatedAt: z.iso.datetime(),
		source: z.enum(['seed', 'browser']),
		record,
	}).refine(mirrorsRecordId, {
		message: 'id must mirror record.id',
		path: ['id'],
	});
}

/**
 * A whole store, serialised: every collection, every record in its envelope,
 * under a version stamp and the moment the export was taken.
 *
 * `version` is a literal rather than a number, which is the point of having
 * it at all. This file is what a person carries between browsers and what
 * they restore from after clearing site data, so it will outlive the shape it
 * was written in. A literal means a payload from a future format is refused
 * by the parse with a message naming the version, instead of being read as
 * far as it happens to parse and silently dropping whatever the reader did
 * not know to look for.
 *
 * `z.strictObject` throughout for the same reason the rule schemas use it: a
 * misspelled key in a hand-edited dump is a rejection, never a key quietly
 * ignored.
 *
 * Absent values are `.nullable()`, never optional. The project generates a
 * strict JSON Schema, and strict mode forbids optional fields, so an optional
 * key here fails the generator rather than this parse, which is a much longer
 * walk back to the cause.
 */
export const dumpSchema = z.strictObject({
	version: z.literal(1),
	exportedAt: z.iso.datetime(),
	collections: z.strictObject({
		yard: z.array(envelopeSchema(yardSchema)),
		plants: z.array(envelopeSchema(plantSchema)),
		rules: z.array(envelopeSchema(ruleSchema)),
		occurrences: z.array(envelopeSchema(occurrenceSchema)),
		tagPolicy: z.array(envelopeSchema(tagPolicySchema)),
	}),
});

export type Dump = z.infer<typeof dumpSchema>;

/**
 * Parses a dump, throwing a full sentence naming the failing path.
 *
 * Shared by every implementation of `Store.load` so all of them fail the same
 * way. The store runs in the browser with nothing tailing a log, so the
 * thrown message is usually the entire diagnosis a user or a reviewer gets,
 * and a raw `ZodError` is not one.
 */
export const parseDump = parseWith(dumpSchema, 'dump');
