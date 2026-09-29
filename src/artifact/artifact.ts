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
	// A fingerprint of the Rules, Plants, Occurrences and tag policy the Plan
	// was made from (ADR 0007). Null on an Artifact written before it existed.
	plannedFrom: z.string().regex(/^[0-9a-f]{16}$/u).nullable(),
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
/**
 * What a failed Narration leaves in the public status record, in place of the Narrator's own error. The record is committed to a public repository and served on a public site, and codex's stderr can say anything, so the full text goes to the machine's log and the record carries only this.
 */
export const NARRATION_FAILED_MESSAGE = 'The Narrator ran into a problem.';

/**
 * How Narration went on the run that produced the published Artifact. `off` is the switch ADR 0001 describes, set on purpose, and reads apart from `failed`, which is a Narrator that threw or answered with something `validateNarration` refused. Either way the run published the Planner's own wording.
 */
const narrationOutcomeSchema = z.strictObject({
	outcome: z.enum(['ran', 'off', 'failed']),
	error: z.string().nullable(),
}).refine(
	narration => (narration.outcome === 'failed') === (narration.error !== null),
	{ message: 'narration.error must be present if and only if narration.outcome is \'failed\'', path: ['error'] },
);

export const statusRecordSchema = z.strictObject({
	attemptedAt: z.iso.datetime(),
	ok: z.boolean(),
	error: z.string().nullable(),
	artifactGeneratedAt: z.iso.datetime().nullable(),
	consecutiveFailures: z.number().int().min(0),
	// Describes the Artifact being served, like `artifactGeneratedAt`, so a run that fails before Narration carries it forward. Null on a record written before #77, or when no run has published yet.
	narration: narrationOutcomeSchema.nullable(),
}).refine(
	status => status.ok === (status.error === null),
	{ message: 'error must be present if and only if ok is false', path: ['error'] },
);

export type StatusRecord = z.infer<typeof statusRecordSchema>;

/**
 * Fills the keys an older Artifact predates with the `null` that absence means:
 * `plannedFrom` on the Artifact, and `guardChecks` on each Task.
 *
 * The schema stays strict for anything writing an Artifact. This runs ahead of
 * the parse because the committed `data/artifact.json` keeps the older shape
 * until the next daily run replaces it, and a failed run keeps it longer. Only
 * a missing key is filled; a present one is parsed as it is.
 */
function withNewerKeys(value: unknown): unknown {
	if (typeof value !== 'object' || value === null || !('plan' in value)) {
		return value;
	}
	const upgraded: Record<string, unknown> = 'plannedFrom' in value ? { ...value } : { ...value, plannedFrom: null };
	const { plan } = value as { plan: unknown };
	if (typeof plan !== 'object' || plan === null || !('tasks' in plan) || !Array.isArray(plan.tasks)) {
		return upgraded;
	}

	return {
		...upgraded,
		plan: {
			...plan,
			tasks: plan.tasks.map((task: unknown) =>
				typeof task === 'object' && task !== null && !('guardChecks' in task) ? { ...task, guardChecks: null } : task),
		},
	};
}

const parseCurrentArtifact = parseWith(artifactSchema, 'artifact');
const safeParseCurrentArtifact = safeParseWith(artifactSchema, 'artifact');

/** Parses an Artifact, throwing a sentence naming the failing path. Used where a bad file should stop the run. */
export const parseArtifact = (value: unknown): Artifact => parseCurrentArtifact(withNewerKeys(value));

/** The same parse returned as a value, for the browser: it has to render an error state, not crash the page. */
export const safeParseArtifact = (value: unknown): ReturnType<typeof safeParseCurrentArtifact> => safeParseCurrentArtifact(withNewerKeys(value));

/** Fills `narration` with the `null` its absence means on a record written before #77, for the reason `withNewerKeys` gives for the Artifact. */
function withNewerStatusKeys(value: unknown): unknown {
	return typeof value === 'object' && value !== null && !('narration' in value) ? { ...value, narration: null } : value;
}

const parseCurrentStatusRecord = parseWith(statusRecordSchema, 'status record');

/** Parses a status record, throwing on a bad one. */
export const parseStatusRecord = (value: unknown): StatusRecord => parseCurrentStatusRecord(withNewerStatusKeys(value));
