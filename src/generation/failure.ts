/**
 * The stage of a generation run that could not complete: fetching the
 * weather, running the Planner, and validating the Plan the Planner
 * returned. `narrate` is missing from that list on purpose. A narrator
 * that throws is not a run failure—it is a run that publishes the
 * Planner's mechanical title instead of the model's prose, which ADR 0001
 * already treats as a first-class output rather than a degraded one. Folding
 * narration into this union would turn an optional, always-safe pass into a
 * fourth way the whole run can fail, which is the opposite of what makes it
 * optional.
 */
export type GenerationStage = 'weather' | 'plan' | 'validate';

/**
 * What a generation run returns instead of an Artifact when one of its
 * stages cannot complete. It is a plain value, never thrown: the run reads a
 * `GenerationFailure` the same way it reads a finished Plan, as data to
 * branch and write a status record from, rather than as an exception to
 * unwind past whatever else the run still owes—the status record next
 * door, in particular.
 */
export interface GenerationFailure {
	stage: GenerationStage;
	message: string;
}

/**
 * Turns a caught `unknown` into a {@link GenerationFailure} for the given
 * stage. A `catch` block in TypeScript sees `unknown`, not `Error`, because
 * nothing about the language stops a thrown value from being a string, a
 * plain object, or anything else a dependency—or a test—decides to
 * throw. Without this, each of the three stages' catch blocks would
 * re-derive the same narrowing to get a readable sentence out of whatever it
 * caught.
 */
export function toGenerationFailure(stage: GenerationStage, cause: unknown): GenerationFailure {
	return { stage, message: describeCause(cause) };
}

/**
 * Reads a message out of a caught value in the order most likely to produce
 * something readable: an `Error`'s own message, a thrown string verbatim,
 * and otherwise a JSON rendering of whatever was thrown. `JSON.stringify`
 * returns `undefined` rather than a string for a handful of values (bare
 * `undefined`, a function, a `Symbol`) and throws outright on a circular
 * object, so `String()` sits behind it as the last resort. Trying
 * `JSON.stringify` first is what turns a thrown plain object into a readable
 * `{"code":"..."}` instead of collapsing every one of them to
 * `[object Object]`.
 */
function describeCause(cause: unknown): string {
	if (cause instanceof Error) {
		return cause.message;
	}
	if (typeof cause === 'string') {
		return cause;
	}
	try {
		const stringified = JSON.stringify(cause);
		if (stringified !== undefined) {
			return stringified;
		}
	}
	catch {
		// Falls through to String(cause) below—a circular structure, for one.
	}
	return String(cause);
}
