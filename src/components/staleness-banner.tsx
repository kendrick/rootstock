import type { ReactElement } from 'react';
import type { StatusRecord } from '@/artifact/artifact';
import { CalendarClock, TriangleAlert } from 'lucide-react';
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
	 * Defaulted here rather than read inside the body so a spec can pin the
	 * instant, and so one render of a page can hand the same `now` to every
	 * banner on it. The default is evaluated per call, not once at module load:
	 * a tab left open over a weekend would otherwise keep answering with the
	 * time the bundle was parsed.
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
 * Says how old the Artifact is, in the two cases where a reader needs telling.
 *
 * Returns null when the data is fresh. Chrome announcing that today's numbers
 * are today's numbers is noise, and CONTEXT.md's Staleness entry is the reason
 * the question is asked on every render instead of baked into the file: "a
 * baked answer becomes a lie the moment the daily run stops."
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
	// react/purity is right that reading the clock mid-render is impure, and the
	// impurity is the point: age is a fact about the moment someone is looking,
	// which is why CONTEXT.md refuses to bake it into the Artifact. The escape
	// hatch is the prop itself — a caller that needs a stable render (a
	// prerendered page, a spec, a page with several banners on it) passes one
	// instant in and gets determinism back.
	// eslint-disable-next-line react/purity -- see above; the default is deliberate, not an oversight
	now = new Date(),
	prominent = false,
}: StalenessBannerProps): ReactElement | null {
	const { band, consecutiveFailures } = staleness(generatedAt, now, status);

	// Fresh renders nothing at all, failing runs included. A run can fail
	// tonight while yesterday's Artifact is still current, and in that window
	// the reader has nothing to act on: the plan in front of them is good, and
	// the broken runner is the household's problem tomorrow, not theirs now.
	if (band === 'fresh') {
		return null;
	}

	const isExpired = band === 'expired';
	const Icon = isExpired ? TriangleAlert : CalendarClock;
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
				prominent ? 'border-2 px-5 py-4 text-base' : 'px-4 py-3 text-sm',
				isExpired
					? 'border-destructive bg-destructive text-destructive-foreground'
					: 'border-border bg-background text-muted-foreground',
			)}
		>
			<Icon aria-hidden="true" className={cn('mt-0.5 shrink-0', prominent ? 'size-5' : 'size-4')} />
			<div className="space-y-1">
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
				{consecutiveFailures > 0 && <p>{failureSentence(consecutiveFailures)}</p>}
			</div>
		</div>
	);
}
