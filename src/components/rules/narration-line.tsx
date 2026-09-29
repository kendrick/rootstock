import type { ReactElement } from 'react';
import type { StatusRecord } from '@/artifact/artifact';

/**
 * One quiet line for the owner when the published ticket went out in the Planner's own wording. It speaks of the run that made the ticket, never the latest run, because a run that fails before Narration carries the previous outcome forward. It lives on the Rules page and stays off This Week and the Away Card, because a failed Narrator changes the words and never the work, and the household banner is kept for runs that didn't publish at all (#77).
 *
 * Null on a narrated run and on a record written before `narration` existed, since neither has anything to report.
 */
export function NarrationLine({ status }: { status: StatusRecord }): ReactElement | null {
	const outcome = status.narration?.outcome;

	if (outcome === 'failed') {
		return (
			<p className="max-w-prose text-note text-muted">
				The Narrator ran into a problem on the run that made this week&apos;s ticket, so the ticket is in the Planner&apos;s own wording. Check
				{' '}
				<code>codex login status</code>
				{' '}
				under the job&apos;s own
				{' '}
				<code>CODEX_HOME</code>
				{' '}
				on the machine that runs it, and read the job&apos;s log for the full error.
			</p>
		);
	}

	if (outcome === 'off') {
		return (
			<p className="max-w-prose text-note text-muted">
				Narration was switched off with
				{' '}
				<code>ROOTSTOCK_NARRATION</code>
				{' '}
				on the run that made this week&apos;s ticket, so the ticket is in the Planner&apos;s own wording.
			</p>
		);
	}

	return null;
}
