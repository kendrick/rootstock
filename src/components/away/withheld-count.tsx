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
 * "Held back" is CONTEXT.md's own verb for a Deferral; "hold", "blocked" and
 * the rest are on the Deferred Task and Deferral _Avoid_ lines. It's also the
 * honest phrase: a Guard paused this work until conditions change, and nobody
 * decided anything about the work itself.
 */
function heldSentence(count: number): string {
	return count === 1
		? '1 more task is held back until conditions change.'
		: `${count} more tasks are held back until conditions change.`;
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

	return `This card isn't the whole week. The rest is the owner's ${verbs}.`;
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
			{/* Points at the card, never "the list above": on the week every fired
			    Task is withheld there's no list above this to point at. */}
			<p>{closingSentence(ownerOnly, deferred)}</p>
		</div>
	);
}
