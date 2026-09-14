import { z } from 'zod';
import { planSchema } from '@/planner/plan';
import { parseWith, safeParseWith } from '@/validation/parse';
import { narrationSchema } from './narration';

/**
 * The committed JSON one generation run produces and the site reads.
 *
 * There is no `asOf` here on purpose. `plan.asOf` is the date the Planner
 * planned for, and a second copy on the envelope is a disagreement waiting to
 * happen: the two would be written by different lines of the runner and only
 * one of them would be the date the Tasks were derived from.
 *
 * There are no coordinates either, in any field, at any depth. ADR 0004 keeps
 * the property's latitude and longitude in the generation environment, and
 * this file is published to a public site. `src/validation/no-coordinates.spec.ts`
 * walks the generated JSON Schema to keep a later field from drifting one in.
 *
 * `narrated` duplicates what `narration !== null` already says, and it stays
 * because it is the field the interface reads: "the model ran and said
 * nothing" and "the model never ran" are different stories to tell a reader,
 * and a component asking `artifact.narrated` says which one it is telling
 * without reasoning about a null. The refine below is what keeps the two
 * honest, so the duplication cannot go stale.
 *
 * Staleness is absent for the same reason `asOf` is: `generatedAt` is the fact,
 * and how old that makes the file is computed in the browser on every render.
 */
export const artifactSchema = z.strictObject({
	version: z.literal(1),
	generatedAt: z.iso.datetime(),
	plan: planSchema,
	narration: narrationSchema.nullable(),
	narrated: z.boolean(),
}).refine(
	artifact => artifact.narrated === (artifact.narration !== null),
	{ message: 'narrated must be true if and only if narration is present', path: ['narrated'] },
);

export type Artifact = z.infer<typeof artifactSchema>;

/**
 * What the runner writes about its own last attempt, committed beside the
 * Artifact so a failed run leaves a trace rather than silently republishing
 * yesterday's file.
 *
 * `consecutiveFailures` is the field that earns the record. One status record
 * describes one attempt, so nothing the runner observes tonight says whether
 * this is the first bad night or the fourth. The runner has to carry the count
 * forward itself, reading the previous record and adding one. That is what
 * lets the site say "the last four runs failed" instead of only "this data is
 * old", and only the first of those tells a reader to go look at the box.
 *
 * It lives beside the Artifact rather than in a module of its own because the Artifact gate parses both at one boundary before anything below it renders, and a reader asks one question of the pair: how old this data is, and whether the run that should have replaced it got that far. Two modules would split a boundary whose whole value is being a single one.
 */
export const statusRecordSchema = z.strictObject({
	attemptedAt: z.iso.datetime(),
	ok: z.boolean(),
	error: z.string().nullable(),
	artifactGeneratedAt: z.iso.datetime().nullable(),
	consecutiveFailures: z.number().int().min(0),
}).refine(
	status => status.ok === (status.error === null),
	{ message: 'error must be present if and only if ok is false', path: ['error'] },
);

export type StatusRecord = z.infer<typeof statusRecordSchema>;

/** Parses an Artifact, throwing a sentence naming the failing path. Used where a bad file should stop the run. */
export const parseArtifact = parseWith(artifactSchema, 'artifact');

/** The same parse returned as a value, for the browser: it has to render an error state, not crash the page. */
export const safeParseArtifact = safeParseWith(artifactSchema, 'artifact');

/** Parses a status record, throwing on a bad one. */
export const parseStatusRecord = parseWith(statusRecordSchema, 'status record');
