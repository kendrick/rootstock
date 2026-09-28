import type { ReactElement } from 'react';

/**
 * Plural only past one. "1 more tasks" reads like a template nobody
 * proofread, and a reader who notices that stops trusting the number beside it.
 */
function ownerSentence(count: number): string {
	return count === 1
		? '1 more task is the owner\'s to do.'
		: `${count} more tasks are the owner's to do.`;
}

/**
 * "On hold" rather than any of the words CONTEXT.md's Deferred Task and
 * Deferral entries rule out. It's also the honest one: a Guard held this work
 * back until conditions change, which is a pause and not a decision anyone
 * made about the work itself.
 */
function heldSentence(count: number): string {
	return count === 1
		? '1 more task is on hold until conditions change.'
		: `${count} more tasks are on hold until conditions change.`;
}

/**
 * Whose the rest is, in the sense each count gives it. Held work is the
 * owner's to decide, not the household's to pick up when the weather turns,
 * and the sentence ends there so the card does too.
 */
function closingSentence(ownerOnly: number, deferred: number): string {
	const verbs = ownerOnly > 0 && deferred > 0
		? 'to do or to decide'
		: ownerOnly > 0 ? 'to do' : 'to decide';

	return `This list isn't the whole week. The rest is the owner's ${verbs}.`;
}

/**
 * How much of the week the card is keeping back, by reason and by count.
 *
 * Names nothing and describes nothing. The chemical work this most often
 * counts is exactly the work that must not reach a household member as an
 * instruction, and a sentence specific enough to identify a task is specific
 * enough to act on.
 *
 * It still has to be here. #15's case is blunt about why: someone who works
 * the list to the bottom and reads a finished list as a finished yard is how a
 * pre-emergent window closes with nobody noticing. The count says that
 * something is missing without saying what, which is the most it can safely
 * say.
 *
 * Renders nothing when there is nothing to report, because a line reading "0
 * tasks" is chrome that teaches a reader to skip the whole block on the week it
 * finally matters.
 */
export function WithheldCount({ ownerOnly, deferred }: { ownerOnly: number; deferred: number }): ReactElement | null {
	if (ownerOnly === 0 && deferred === 0) {
		return null;
	}

	return (
		<div className="space-y-1 border-t-2 border-rule px-5 py-4 font-mono text-evidence text-muted print:border-black print:break-inside-avoid print:text-black">
			{ownerOnly > 0 && <p>{ownerSentence(ownerOnly)}</p>}
			{deferred > 0 && <p>{heldSentence(deferred)}</p>}
			{/* Says "list", never "the list above": on the week every fired Task
			    is withheld there's no list above this to point at. */}
			<p>{closingSentence(ownerOnly, deferred)}</p>
		</div>
	);
}
