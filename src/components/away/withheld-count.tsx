import type { ReactElement } from 'react';

/**
 * Plural only past one. "1 tasks are for the owner" reads like a template
 * nobody proofread, and a reader who notices that stops trusting the number
 * beside it.
 */
function ownerSentence(count: number): string {
	return count === 1
		? '1 task is for the owner to do.'
		: `${count} tasks are for the owner to do.`;
}

/**
 * "Waiting" rather than any of the words CONTEXT.md's Deferred Task and
 * Deferral entries rule out. It is also the honest one: a Guard held this work
 * back until the weather changes its mind, which is a pause and not a decision
 * anyone made about the work itself.
 */
function waitingSentence(count: number): string {
	return count === 1
		? '1 task is waiting for conditions to change.'
		: `${count} tasks are waiting for conditions to change.`;
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
		<div className="space-y-1 border-t border-border pt-4 text-sm text-muted-foreground sm:text-base print:border-black print:break-inside-avoid print:text-black">
			{ownerOnly > 0 && <p>{ownerSentence(ownerOnly)}</p>}
			{deferred > 0 && <p>{waitingSentence(deferred)}</p>}
			<p>The list above is not everything the yard needs this week.</p>
		</div>
	);
}
