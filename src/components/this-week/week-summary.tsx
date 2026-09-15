import type { ReactElement } from 'react';
import { Section } from './section';

export interface WeekSummaryProps {
	/** `narration.summary`. Null, omitted, or blank for an Artifact the model never narrated. */
	summary?: string | null;
}

/**
 * The model's sentences about the week as a whole.
 *
 * `narrationSchema.summary` is required and its own `.describe()` says it is
 * "read before any individual task". #50 found the field by reading the
 * Artifact rather than the page, because no component referred to it: it was
 * generated, validated and committed on every run and read by nobody. A field
 * nothing consumes rots, because nobody notices the day the narrator starts
 * writing a bad one.
 *
 * Its own slot, above the groups and below the authored purpose copy in
 * `purpose.tsx`. This summary cannot double as the statement of purpose. The
 * brief asks what the page is, and the summary says what the week holds, which
 * today is a restatement of the three list items under it.
 *
 * Returns null on an unnarrated Artifact rather than an empty heading, the
 * same call `Advisories` makes. ADR 0001 treats a run without Narration as a
 * whole output, so the absence is normal and has nothing to report.
 */
export function WeekSummary({ summary = null }: WeekSummaryProps): ReactElement | null {
	if (summary === null || summary.trim() === '') {
		return null;
	}

	return (
		<Section id="week-summary-heading" label="The week in the yard">
			<p className="max-w-prose text-body text-foreground">{summary}</p>
		</Section>
	);
}
