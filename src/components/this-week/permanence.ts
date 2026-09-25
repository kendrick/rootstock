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

import { MONTHS } from '@/planner/dates';

/**
 * How long a sign-off waits before the Store write, and the only thing in the
 * interface that can be taken back. Nothing is written during the wait, so a
 * cancel costs the append-only log nothing. It lives beside the words because
 * the announcement below states the length, and a timer tuned without the
 * sentence would leave the page promising a window it no longer gives.
 */
export const RECORD_DELAY_MS = 4000;

/**
 * The half both messages end on, and the only sentence stating the policy.
 * It names what cannot happen. "Nothing here to undo" denies the one thing a
 * reader who just tried to untick wants, and reads as a dodge.
 */
const NO_UNDO = 'The yard only adds to its history, so a record cannot be removed.';

function spokenDay(isoDate: string): string {
	const [, month, day] = isoDate.split('-');
	const name = month === undefined ? undefined : MONTHS[Number(month) - 1];
	return name === undefined || day === undefined ? isoDate : `${name} ${Number(day)}`;
}

/**
 * Read before the first sign-off, over the group that carries them.
 *
 * Names the Plan's day rather than saying "today". The Occurrence is dated to
 * the Plan (`completionInstant` in `this-week.tsx`), so on a plan left stale
 * over a weekend "today" would be false. "In this browser" because a sign-off lives
 * in this browser's Store and never reaches the published site, and a
 * household member signing off on their own phone has no other way to learn
 * that.
 */
export function permanenceNote(asOf: string | null): string {
	const when = asOf === null ? '' : ` on ${spokenDay(asOf)}`;
	return `Signing off records the work as done${when}, in this browser only. A second tap within ${RECORD_DELAY_MS / 1000} seconds cancels. After that it cannot be taken back, because the yard keeps every record and changes none.`;
}

/** What a refused untick says, on the Task and in the live region. */
export const UNDO_REFUSAL = `This one stays recorded. ${NO_UNDO}`;

/** Said once, when a sign-off starts its wait. */
export function pendingAnnouncement(taskText: string): string {
	return `Recording in ${RECORD_DELAY_MS / 1000} seconds: ${asSentence(taskText)} Press the box again to cancel.`;
}

/**
 * How long after the wait runs out a tap still reads as a cancel that missed,
 * rather than an attempt to undo old work. Long enough to cover a thumb that
 * left for the second tap as the fill finished.
 */
export const LATE_GRACE_MS = 3000;

/** Said, and left on the row, when a cancel lands just after the wait ran out. */
export const TOO_LATE = `Too late to cancel. The ${RECORD_DELAY_MS / 1000} seconds had run out, so this is recorded. ${NO_UNDO}`;

/** Said when a reader cancels inside the wait. */
export const CANCELLED = 'Cancelled. Nothing was recorded.';

/** Left on the row, and spoken, when the Store refused the write. */
export const NOT_SAVED = 'Not recorded: this browser could not save the sign-off. Try again.';

/**
 * Shown over the work when the browser Store will not open. The page turns
 * sign-off off rather than letting it fail tap by tap, and the sentence says
 * the Plan is untouched, because the Plan never came from this Store.
 */
export const STORE_UNAVAILABLE = 'This browser cannot open its record of finished work, so sign-off is off and earlier sign-offs from this browser do not show. The tasks below are unaffected.';

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
