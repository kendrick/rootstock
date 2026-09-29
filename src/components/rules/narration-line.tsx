import type { ReactElement } from 'react';
import type { StatusRecord } from '@/artifact/artifact';

/**
 * One quiet line for the owner when the published ticket went out in the Planner's own wording. It lives on the Rules page and stays off This Week and the Away Card, because a failed Narrator changes the words and never the work, and the household banner is kept for runs that didn't publish at all (#77).
 *
 * Null on a narrated run and on a record written before `narration` existed, since neither has anything to report.
 */
export function NarrationLine({ status }: { status: StatusRecord }): ReactElement | null {
	const outcome = status.narration?.outcome;

	if (outcome === 'failed') {
		return (
			<p className="max-w-prose text-note text-muted">
				The last run&apos;s Narrator ran into a problem, so this week&apos;s ticket is in the Planner&apos;s own wording. Run
				{' '}
				<code>codex login status</code>
				{' '}
				on the machine that runs it, and read its launchd log for the full error.
			</p>
		);
	}

	if (outcome === 'off') {
		return (
			<p className="max-w-prose text-note text-muted">
				Narration is switched off with
				{' '}
				<code>ROOTSTOCK_NARRATION</code>
				{' '}
				in the run&apos;s env file, so this week&apos;s ticket is in the Planner&apos;s own wording.
			</p>
		);
	}

	return null;
}
