/*
 * Narration is the model's pass over a finished Plan: it selects Tasks, orders them, and writes the
 * prose.
 *
 * Every field below is a string or an array of strings, and the constraint is deliberate. This is
 * the only schema in the project that leaves TypeScript as a JSON Schema file. `codex exec
 * --output-schema` forwards it to the Responses API as a strict `json_schema` format, and strict
 * mode accepts a narrow subset of keywords. A keyword outside that subset fails at the API as an
 * HTTP 400 naming `codex_output_schema`, and that is the whole diagnostic: no local test catches
 * it, no type error precedes it, and the response never says which field did it. So this shape
 * emits only what strict mode takes, and narration.spec.ts checks the emission against an
 * allowlist. A Zod upgrade that starts emitting a new keyword then fails a test here instead of a
 * generation run.
 *
 * Verified against Zod 4.6: `discriminatedUnion` emits `oneOf`, `literal` emits `const`,
 * `number().int()` emits `minimum` and `maximum`, and `iso.date()` emits `format` plus a pattern
 * several hundred characters long. Strict mode takes none of those, which is why there is no rank
 * field, no date, and no tagged union here.
 *
 * Task order is array position. An explicit index would be a second source of truth the model could
 * contradict, and the repair for a contradiction is to trust position anyway.
 *
 * ADR 0001 describes validation as rejecting a narration that cites a rule ID the Plan did not
 * contain. Keying on the task id is deliberately stricter than that. One Rule fires for several
 * Plants, so a rule ID names a set of Tasks rather than one, and a narration citing a real rule ID
 * could still describe a Task the Planner never wrote. The task id is the precise handle, so the
 * membership check downstream runs against it. Nothing the rule-ID check rejects would pass this
 * one.
 */

import type { JsonSchema } from '@/validation/json-schema';
import { z } from 'zod';
import { parseWith } from '@/validation/parse';

/** The shape the model returns when it narrates a Plan. */
export const narrationSchema = z.strictObject({
	summary: z
		.string()
		.describe('A few sentences about the week in the yard as a whole, read before any individual task.'),
	tasks: z
		.array(
			z.strictObject({
				taskId: z
					.string()
					.describe('The id of a task from the plan you were given. Select from that plan; never invent an id.'),
				text: z
					.string()
					.describe('The sentence a person reads for that task, in plain language.'),
			}),
		)
		.describe('The tasks worth doing this week, in the order they should be read.'),
	advisories: z
		.array(
			z.strictObject({
				text: z
					.string()
					.describe('Something you noticed that no rule produced, in a sentence or two.'),
			}),
		)
		.describe('Observations the plan did not cover. An empty array is a normal answer.'),
});

export type Narration = z.infer<typeof narrationSchema>;

export const parseNarration = parseWith(narrationSchema, 'narration');

/** The JSON Schema handed to the model, with the `$schema` dialect declaration removed. */
export function narrationJsonSchema(): JsonSchema {
	// Dropping `$schema` is the only edit made to Zod's output. Strict mode has no use for the
	// dialect declaration and Zod offers no option to suppress it, so it comes off here. Everything
	// else stays generated, because a schema hand-tuned away from `narrationSchema` drifts from the
	// type the rest of the code parses against, and nothing local would catch that drift.
	const { $schema: _dialect, ...schema } = z.toJSONSchema(narrationSchema);
	return schema;
}
