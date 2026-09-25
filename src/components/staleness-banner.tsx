'use client';

import type { ReactElement } from 'react';
import type { StatusRecord } from '@/artifact/artifact';
import { CalendarClock, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { staleness } from '@/artifact/staleness';
import { cn } from '@/lib/utils';

/**
 * A household member reads this, not an operator, so the generation time is
 * spelled out in words. `en-US` is pinned rather than left to the visitor's
 * locale because every other string on the page is written in English by hand;
 * a German month name beside English prose reads as a bug, not a courtesy.
 */
const GENERATION_TIME = new Intl.DateTimeFormat('en-US', {
	weekday: 'long',
	month: 'long',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
});

/**
 * Plural only past one, because "the last 1 run failed" reads like a template
 * that got away from someone. The number is on the page either way: artifact.ts
 * makes the count the thing worth saying, since "the last four runs failed"
 * sends a reader to the box and "this data is old" does not.
 */
function failureSentence(consecutiveFailures: number): string {
	const runs = consecutiveFailures === 1
		? 'The last run'
		: `The last ${consecutiveFailures} runs`;

	return `${runs} failed, so nothing newer has arrived. Worth a look at the computer that puts this together.`;
}

export interface StalenessBannerProps {
	/** The Artifact's own `generatedAt`. The only fact it carries about its age. */
	generatedAt: string;
	status: StatusRecord;
	/**
	 * Pins the instant the age is measured against. Omit it and the banner reads
	 * the clock on every render instead, which is what a route wants: the age is
	 * a fact about the moment someone is looking, so a tab left open across the
	 * 36-hour line has to change band without a reload.
	 *
	 * Passing one buys determinism, and a spec is the caller that needs it. It
	 * also suppresses the mount gate below, because a caller supplying its own
	 * instant has already decided what render one means.
	 */
	now?: Date;
	/**
	 * The Away Card's variant. That view is printed and carried around the yard,
	 * so its reader cannot glance at the site to check whether anything moved;
	 * the warning has to survive being on paper in someone else's hand.
	 */
	prominent?: boolean;
}

/**
 * Says how old the Artifact is, and whether the runner that produces it is
 * still working. Those are two signals rather than one, and they are reported
 * independently: current data can sit behind a runner that failed last night.
 *
 * Renders nothing when the data is fresh AND every recent run succeeded. Chrome
 * announcing that today's numbers are today's numbers is noise, and CONTEXT.md's
 * Staleness entry is the reason the question is asked on every render instead of
 * baked into the file: "a baked answer becomes a lie the moment the daily run
 * stops."
 *
 * The band comes from `staleness()` and is never re-derived from `ageHours`
 * here. The 36-hour and 7-day boundaries live in exactly one file, and a second
 * copy in a component is how the banner and the band function end up
 * disagreeing about what a reader is looking at.
 *
 * There is no dismiss control, and adding one would defeat the component. Old
 * data does not become current because somebody clicked away the notice about
 * it, and the Task list underneath stays just as wrong.
 */
export function StalenessBanner({
	generatedAt,
	status,
	now,
	prominent = false,
}: StalenessBannerProps): ReactElement | null {
	// `output: 'export'` prerenders every route in Node, so a clock read during
	// the first render would bake the build machine's instant into the HTML and
	// the browser would contradict it on hydration. Rendering nothing until the
	// effect fires keeps the timestamp out of the exported file, and the renders
	// after that read the clock freely.
	//
	// A mount flag rather than the instant itself, because storing the instant
	// would freeze it: the band would then be whatever it was when the tab
	// opened, and the tab left open over a weekend—the case CONTEXT.md's
	// Staleness entry exists for—would never change band at all.
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		// eslint-disable-next-line react/set-state-in-effect -- the prerender has to run once with no clock at all, so the extra render is the point
		setMounted(true);
	}, []);

	// react/purity is right that reading the clock mid-render is impure, and the
	// impurity is what the feature is: age is a fact about the moment someone is
	// looking, which is why CONTEXT.md refuses to bake it into the Artifact.
	// eslint-disable-next-line react/purity -- see above; every render past the first is meant to re-read the clock
	const asOf = now ?? (mounted ? new Date() : null);
	if (asOf === null) {
		return null;
	}

	const { band, consecutiveFailures } = staleness(generatedAt, asOf, status);

	const isFresh = band === 'fresh';
	const hasFailures = consecutiveFailures > 0;

	// Silence needs both halves to be true. A run that failed last night leaves
	// the Artifact current and the runner broken, and artifact.ts keeps the count
	// precisely because that case is worth saying out loud: "the last four runs
	// failed" sends a reader to the box, where "this data is old" does not.
	// Waiting for the file to age out of the fresh band before mentioning it
	// would sit on the news for the better part of a day.
	if (isFresh && !hasFailures) {
		return null;
	}

	const isExpired = band === 'expired';
	// A fresh Artifact here means the only news is the failed run, so the icon
	// points at that rather than at a date nobody needs to worry about yet.
	const Icon = isExpired || isFresh ? TriangleAlert : CalendarClock;
	const when = GENERATION_TIME.format(Date.parse(generatedAt));

	return (
		<div
			// role="status" and not "alert" in either band. An assertive region cuts
			// across whatever a screen reader is already saying, and nothing here is
			// urgent enough to earn that: the page is a gardening plan, and the news
			// is that it is a few days behind. #16 runs axe over this.
			role="status"
			className={cn(
				'flex items-start gap-3 rounded-md border',
				prominent ? 'border-2 px-5 py-4 text-body' : 'px-4 py-3 text-note',
				isExpired
					? 'border-destructive bg-destructive text-destructive-foreground'
					: 'border-border bg-background text-muted-foreground',
			)}
		>
			<Icon aria-hidden="true" className={cn('mt-0.5 shrink-0', prominent ? 'size-5' : 'size-4')} />
			<div className="space-y-1">
				{/* The age paragraph is skipped entirely while the data is still fresh.
				    Telling a reader their current plan is current, in order to reach the
				    sentence about the runner, would bury the only part that matters. */}
				{!isFresh && (
					<p>
						{isExpired ? 'This plan was put together ' : 'This plan is from '}
						{/* The machine-readable timestamp rides along on the element rather
						    than replacing the words, so a reader gets a day of the week and a
						    scraper still gets the instant. */}
						<time dateTime={generatedAt} className="font-medium">{when}</time>
						{isExpired
							? ', more than a week ago. Enough weather has passed that your own look at the yard beats anything on this page.'
							: '. Nothing newer has come in since.'}
					</p>
				)}
				{hasFailures && <p>{failureSentence(consecutiveFailures)}</p>}
			</div>
		</div>
	);
}
