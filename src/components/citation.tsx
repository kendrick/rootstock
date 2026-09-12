import type { ReactElement, ReactNode } from 'react';
import type { Citation } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import type { Aggregate, Variable } from '@/weather/observation';
import { ChevronRight, TriangleAlert } from 'lucide-react';
import { RuleSummary } from '@/components/rule-summary';
import { cn } from '@/lib/utils';

/*
 * Copied out of rule-summary.tsx rather than imported from it. That file does
 * not export these maps, and contract 11 freezes it so #14 can reuse it
 * unchanged; adding an export to save two small objects would edit a file this
 * component is only meant to compose. Either file needs them because the enum
 * values are wire spellings: `soil-temperature` beside `mean` reads as a dump
 * of the JSON rather than a sentence about the lawn.
 */
const VARIABLE_TEXT: Record<Variable, string> = {
	'soil-temperature': 'soil temperature',
	'precipitation': 'rainfall',
	'precipitation-probability': 'chance of rain',
};

const AGGREGATE_TEXT: Record<Aggregate, string> = {
	mean: 'mean',
	min: 'minimum',
	max: 'maximum',
	sum: 'total',
};

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

/**
 * Splits the ISO string instead of parsing it. `new Date('2026-09-11')` is UTC
 * midnight, so a reader west of Greenwich would see the evidence land a day
 * early. Every date a Citation carries is a calendar day the Planner already
 * settled on, so no time zone has any business touching it on the way to the
 * screen.
 */
function formatDate(isoDate: string): string {
	const [year, month, day] = isoDate.split('-');
	const name = month === undefined ? undefined : MONTHS[Number(month) - 1];

	return name === undefined || day === undefined || year === undefined
		? isoDate
		: `${name} ${Number(day)}, ${year}`;
}

/**
 * Renders a calendar day the Artifact already carries, never a clock read.
 * That distinction is what makes `<time>` safe in a static export, because
 * nothing here changes between the build and the reader; the server markup and
 * the hydrated render cannot disagree.
 */
function EvidenceDate({ date }: { date: string }): ReactElement {
	return <time dateTime={date}>{formatDate(date)}</time>;
}

function Row({ term, children }: { term: string; children: ReactNode }): ReactElement {
	return (
		<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
			<dt className="shrink-0 text-muted-foreground">{term}</dt>
			<dd className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-foreground">{children}</dd>
		</div>
	);
}

/** What the run read, in the words a household member uses for it. */
function seriesPhrase(citation: Extract<Citation, { variable: Variable }>): string {
	const depth = citation.depthCm === null ? '' : ` at ${citation.depthCm} cm`;

	return `Daily ${AGGREGATE_TEXT[citation.aggregate]} ${VARIABLE_TEXT[citation.variable]}${depth}`;
}

/**
 * The dated half of the Citation, one branch per kind. No value and no unit
 * appear anywhere below, because the Citation carries neither. ADR 0003 puts
 * the readings themselves on `Plan.window`, and a number invented here to round
 * out a sentence would be a reading nobody observed.
 */
function Evidence({ citation }: { citation: Citation }): ReactElement {
	switch (citation.kind) {
		case 'window':
			// RuleSummary's "Window" row already carries the Rule's range. This row
			// carries the one day that fell inside it, which is what dates the Task.
			return (
				<Row term="Inside the window">
					<EvidenceDate date={citation.date} />
				</Row>
			);

		case 'threshold':
			return (
				<Row term="Observed run">
					<span>
						{`${seriesPhrase(citation)}, `}
						<EvidenceDate date={citation.from} />
						{' through '}
						<EvidenceDate date={citation.to} />
					</span>
				</Row>
			);

		case 'threshold-projection':
			return (
				<Row term="Forecast">
					<span>
						{`${seriesPhrase(citation)} is expected to meet the Rule on `}
						<EvidenceDate date={citation.projectedDate} />
					</span>
					{/*
					 * CONTEXT.md's Approaching Task entry is the reason this sentence
					 * exists. Forecasts get revised, and a Task that has fired must never
					 * un-fire because the weather changed its mind. A reader who cannot
					 * tell a forecast row from an observed run has no way to know which
					 * of the two can still move.
					 */}
					<span className="basis-full text-muted-foreground">
						Nothing has met the Rule yet, and a forecast can be revised.
					</span>
				</Row>
			);

		case 'cadence':
			return (
				<>
					{/*
					 * A null anchor is evidence, not a missing field to skip past.
					 * CONTEXT.md's Cadence Rule entry makes "there is no Occurrence to
					 * measure from" one of the two ways a Cadence Rule fires, so this row
					 * says it out loud.
					 *
					 * The id renders raw for the same reason rule-summary renders an
					 * anchor Rule's id raw. This component is handed one Citation and no
					 * Occurrence history, and taking one just to prettify a string would
					 * put a second source of Occurrences into a view that only describes
					 * the evidence it was given.
					 */}
					<Row term="Counted from">
						{citation.lastOccurrenceId === null
							? <span>No earlier Occurrence, which is what fired the Rule</span>
							: <code className="font-mono">{citation.lastOccurrenceId}</code>}
					</Row>

					{citation.elapsedDays !== null && (
						<Row term="Elapsed">
							{citation.elapsedDays === 1 ? '1 day' : `${citation.elapsedDays} days`}
						</Row>
					)}
				</>
			);
	}
}

export interface CitationDisclosureProps {
	/** The line a reader sees before expanding: the Task's text. Goes in <summary>. */
	summary: ReactNode;
	citation: Citation;
	/** Null when the Artifact cites a Rule this rule set does not carry. */
	rule: Rule | null;
	delegable?: boolean | null;
	/** Rendered inside the disclosure below the evidence. */
	children?: ReactNode;
}

/**
 * One Task's evidence, behind a native `<details>`. RuleSummary says what the
 * Rule asks for with no date on it; everything dated is here, and the two
 * together are the Citation as CONTEXT.md defines it.
 *
 * `<details>` rather than a collapsible component, per contract 5. The open
 * state is the element's own, so there is no client state to hydrate, the
 * summary is already a button to a screen reader, and a reader whose
 * JavaScript never arrives can still open the evidence behind every Task on
 * the page. A site whose whole claim is that its reasoning is inspectable
 * cannot put that reasoning behind a script.
 *
 * No heading element anywhere below, and nothing interactive inside the
 * `<summary>`. The route owns the page's only h1, and a control nested in a
 * summary fights the disclosure for the same click and the same key press. The
 * check-off box lives in task-item.tsx, beside this component rather than
 * inside its summary.
 */
export function CitationDisclosure({
	summary,
	citation,
	rule,
	delegable = null,
	children,
}: CitationDisclosureProps): ReactElement {
	return (
		<details className="group rounded-md border border-border bg-card">
			<summary
				className={cn(
					'flex list-none items-start gap-2 rounded-md px-3 py-2 text-sm',
					'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
					'[&::-webkit-details-marker]:hidden',
				)}
			>
				<ChevronRight
					aria-hidden="true"
					className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
				/>
				<span className="min-w-0 flex-1 text-foreground">{summary}</span>
			</summary>

			<div className="space-y-3 border-t border-border px-3 py-3 text-sm">
				{/*
				 * `data/artifact.json` cites `deep-water-fig` and `src/seed/rules.json`
				 * has no such Rule, so this line is a case the shipped data already
				 * reaches, not a defensive branch. ADR 0002 makes the same argument one
				 * level up: a Task that quietly loses the Rule behind it is
				 * indistinguishable from one nobody wrote. So this names the gap and
				 * renders the evidence anyway.
				 */}
				{rule === null
					? (
							<p className="flex items-start gap-2 text-muted-foreground">
								<TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
								<span>
									The Rule behind this Task is not in the current rule set, so nothing here can
									say what it asked for. Its evidence still stands as the Artifact recorded it.
								</span>
							</p>
						)
					: <RuleSummary rule={rule} delegable={delegable} />}

				<dl className="space-y-1">
					<Evidence citation={citation} />
				</dl>

				{children}
			</div>
		</details>
	);
}
