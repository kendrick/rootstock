import type { ReactElement } from 'react';
import { seedYard } from '@/seed';
import { dayOfMonth } from './citation-line';

export interface PurposeProps {
	/** Defaults to the seed yard's own region, so the copy cannot outlive the yard it describes. */
	region?: string;
	/**
	 * `Plan.asOf`. The only place a fresh page states which day it was planned
	 * for; the staleness banner is silent while the plan is current. Omitted,
	 * the sentence falls back to "every morning".
	 */
	planned?: string | null;
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
 *
 * Two short sentences, because the daily reader meets them every morning. The
 * kinds of evidence, and what the model may and may not do, belong to the
 * first-visit band, which a returning reader has dismissed.
 */
export function Purpose({ region = seedYard.region.name, planned = null }: PurposeProps = {}): ReactElement {
	const when = planned === null ? 'Planned again every morning' : `Planned ${dayOfMonth(planned)}`;

	return (
		<p className="max-w-prose text-body text-muted">
			{`${when} for one yard in ${region}. `}
			{/*
			 * The one sentence a reviewer has ten seconds for, so it carries the
			 * foreground weight and the one before it stays muted.
			 */}
			<span className="text-foreground">
				Every task names the rule that called for it and the evidence that fired it.
			</span>
		</p>
	);
}
