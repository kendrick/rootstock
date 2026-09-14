/**
 * The words This Week uses for the one thing a reader can do to the yard, and
 * the one thing they cannot undo.
 *
 * An Occurrence is append-only (CONTEXT.md), so the interface owes a reader
 * that fact rather than leaving them to discover it: before the tick, in the
 * note over the list; at the tick, in the live region; and after a refused
 * untick, in the line left behind on the Task. Three places that have to
 * agree, which is why the strings are here instead of typed into each of them.
 */

/** The half both messages end on, and the only sentence stating the policy. */
const NO_UNDO = 'The yard only adds to its history, so there is nothing here to undo.';

/** Read before the first box is ticked, over the group that carries them. */
export const PERMANENCE_NOTE
	= 'Ticking a box records the work as done today. The yard keeps every record and changes none, so a tick cannot be taken back.';

/** What a refused untick says, on the Task and in the live region. */
export const UNDO_REFUSAL = `This one stays recorded. ${NO_UNDO}`;

/**
 * Ends a sentence that may not have been written as one. A Task's text is
 * either the model's line, which ends in a full stop, or the Planner's
 * mechanical title, which does not, and a screen reader running the two
 * together is how "Front lawn the yard only adds" happens.
 */
function asSentence(text: string): string {
	const trimmed = text.trim();
	return /[!.?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** What the live region says once the Store has agreed the Occurrence exists. */
export function recordedAnnouncement(taskText: string): string {
	return `Recorded: ${asSentence(taskText)} ${NO_UNDO}`;
}
