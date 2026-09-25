import type { ReactElement } from 'react';
import { seedYard } from '@/seed';

export interface PurposeProps {
	/** Defaults to the seed yard's own region, so the copy cannot outlive the yard it describes. */
	region?: string;
}

/**
 * What This Week is, above the first task.
 *
 * The claim is the product. ADR 0001 spends the whole system on the property
 * that the model cannot author a Task, and a page that never says so leaves
 * that property unfalsifiable from the outside. #50 measured the route at
 * 1440x900 and found two strings ahead of the first task, `<h1>This Week` and
 * `<h2>Ready now`, so a reader arriving cold got a bare list of work with no
 * claim attached to it.
 *
 * Authored copy and not `narration.summary`, which `week-summary.tsx` renders
 * a slot below. The two answer different questions: this one says what the
 * page is, and that one says what the week holds. The model can only ever
 * write the second.
 *
 * The region is read off the yard rather than typed in. It is the one fact
 * here that could go stale, and it is already recorded.
 */
export function Purpose({ region = seedYard.region.name }: PurposeProps = {}): ReactElement {
	return (
		<p className="max-w-prose text-body text-muted">
			{`One yard in ${region}, planned again every morning. `}
			{/*
			 * The one sentence a reviewer has ten seconds for, so it carries the
			 * foreground weight and the two around it stay muted. One emphasis in
			 * one paragraph, because emphasis on every line is emphasis on none.
			 */}
			<span className="text-foreground">
				Every task here names the rule that called for it and the evidence it fired on: a date inside the rule's window, a run of soil readings, or the last time the work was recorded.
			</span>
			{' Open Rule and evidence under any task for the full record.'}
		</p>
	);
}
