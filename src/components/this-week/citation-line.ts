import type { Citation } from '@/planner/task';
import { MONTHS } from '@/planner/dates';

/**
 * A Citation compressed to one line that always renders.
 *
 * The disclosure beside it still carries the full apparatus—rule, source,
 * region, window, product label, delegability, the dated evidence itself—and
 * that is not what this replaces. This is the part that may never be folded
 * away: the approved direction puts evidence on its own line under every
 * instruction precisely because the category answer is a "Why this?" link, and
 * a link is a promise that the reasoning exists rather than a demonstration
 * that it does.
 *
 * Short enough to read at a glance in sun, and honest about the shape of what
 * fired: a window names its date, an observed run names its span, a cadence
 * names the interval or says plainly that there is nothing to measure from.
 */

export function shortDate(isoDate: string): string {
	const [year, month, day] = isoDate.split('-');
	const name = month === undefined ? undefined : MONTHS[Number(month) - 1];

	return name === undefined || day === undefined || year === undefined
		? isoDate
		: `${name.slice(0, 3)} ${Number(day)} ${year}`;
}

export function citationLine(citation: Citation): string {
	switch (citation.kind) {
		case 'window':
			return `Window / ${shortDate(citation.date)}`;

		case 'threshold':
			return `Observed run / ${shortDate(citation.from)} to ${shortDate(citation.to)}`;

		// Named apart from a satisfied run on purpose. A forecast gets revised, and
		// a Task that has fired must never look like one that has not, so the word
		// the line leads with is the one that says which of the two this is.
		case 'threshold-projection':
			return `Forecast / ${shortDate(citation.projectedDate)}`;

		case 'cadence':
			// CONTEXT.md: a Cadence Rule fires when an interval has elapsed since the
			// most recent Occurrence, or when there is no Occurrence to measure from.
			// Those are different facts and the line says which one applies rather
			// than printing a zero that would read as "done today". "Earlier"
			// because the line stays after a sign-off, beside the day it was
			// recorded, and "no occurrence recorded" there reads as a contradiction.
			return citation.elapsedDays === null
				? 'No earlier record'
				: `${citation.elapsedDays} days since last recorded`;
	}
}
