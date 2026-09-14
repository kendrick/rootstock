import type { ReactElement, ReactNode } from 'react';
import type { DailyAggregate } from '@/planner/plan';
import type { Citation } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import type { Variable } from '@/weather/observation';
import { ChevronRight, TriangleAlert } from 'lucide-react';
import { RuleSummary } from '@/components/rule-summary';
import { AGGREGATE_TEXT, formatValue, VARIABLE_TEXT } from '@/components/series-text';
import { FOCUS_RING } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { MONTHS } from '@/planner/dates';

/*
 * This component and `rule-summary.tsx` keep their own `Row` and their own date formatter rather than sharing either. `Row` here baselines a `<time>` against its label where rule-summary centres a badge against its own, and the two formatters read different shapes: a yearless `MM-DD` window on a Rule, against a full ISO day on a Citation.
 */

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

/**
 * The days of the window the Citation points at: same series, same depth, same
 * reduction, inside the run it names. All three fields and not `variable`
 * alone, because a window may carry one variable at two depths, or a mean
 * beside a max, and a row mixing those would be a reading nobody observed.
 *
 * Dates compare as strings on purpose. Both ends are `z.iso.date()`, so lexical
 * order is calendar order, and parsing them would hand a time zone the chance
 * to move a day the Planner already settled on.
 */
function citedReadings(
	citation: Extract<Citation, { kind: 'threshold' }>,
	window: DailyAggregate[],
): DailyAggregate[] {
	return window.filter(day =>
		day.variable === citation.variable
		&& day.depthCm === citation.depthCm
		&& day.aggregate === citation.aggregate
		&& day.date >= citation.from
		&& day.date <= citation.to);
}

/** What the run read, in the words a household member uses for it. */
function seriesPhrase(citation: Extract<Citation, { variable: Variable }>): string {
	const depth = citation.depthCm === null ? '' : ` at ${citation.depthCm} cm`;

	return `Daily ${AGGREGATE_TEXT[citation.aggregate]} ${VARIABLE_TEXT[citation.variable]}${depth}`;
}

/**
 * The dated half of the Citation, one branch per kind.
 *
 * A Citation carries no value of its own, so the readings come off
 * `Plan.window`. ADR 0003 ships that window for this: it turns the Citation
 * from a sentence into something a reader can check, and it answers "how close
 * are we". Every number below is lifted off a DailyAggregate, unit included, so
 * nothing here can state a reading the run did not record.
 */
function Evidence({ citation, window }: { citation: Citation; window: DailyAggregate[] }): ReactElement {
	switch (citation.kind) {
		case 'window':
			// RuleSummary's "Window" row already carries the Rule's range. This row
			// carries the one day that fell inside it, which is what dates the Task.
			return (
				<Row term="Inside the window">
					<EvidenceDate date={citation.date} />
				</Row>
			);

		case 'threshold': {
			const readings = citedReadings(citation, window);

			return (
				<>
					<Row term="Observed run">
						<span>
							{`${seriesPhrase(citation)}, `}
							<EvidenceDate date={citation.from} />
							{' through '}
							<EvidenceDate date={citation.to} />
						</span>
					</Row>

					{/*
					 * With no window, or a window holding nothing for these days, the
					 * row does not render at all. A missing reading is not a zero, and a
					 * dash beside a date reads as a number that failed to load.
					 */}
					{readings.length > 0 && (
						<Row term="Readings">
							{readings.map(day => (
								<span key={day.date} className="whitespace-nowrap">
									<EvidenceDate date={day.date} />
									{` · ${formatValue(day.value, day.unit)}`}
								</span>
							))}
						</Row>
					)}
				</>
			);
		}

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

/**
 * The words the brief sentence uses, so the label a reader clicks is the
 * promise the page made. Not exported: `react-refresh/only-export-components`
 * wants this file to export components and nothing else, and a constant is not
 * worth a module of its own. The specs assert the literal, which pins the
 * actual words rather than pinning them to themselves.
 */
const CITATION_LABEL = 'Rule and reading';

export interface CitationDisclosureProps {
	citation: Citation;
	/** Null when the Artifact cites a Rule this rule set does not carry. */
	rule: Rule | null;
	delegable?: boolean | null;
	/**
	 * Renders the panel already open. The caller decides which one, because only
	 * the caller knows how many are on the page.
	 */
	defaultOpen?: boolean;
	/**
	 * `Plan.window`, for the readings behind a threshold Citation. Omitting it
	 * costs the reading row and nothing else, which is what a caller holding a
	 * Citation and no Plan needs.
	 */
	window?: DailyAggregate[];
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
 * The summary says what is behind it and names the Rule beside those words.
 * The Task's own text belongs to the row above and never here. A summary
 * carrying that text puts the thing a reader came to do inside the disclosure
 * control, and leaves the evidence itself advertised by a 16px chevron: #50
 * counted three visible tasks against zero visible citations on that shape.
 *
 * Amber is the one hue in the product and its job is to mark a cited line, so
 * the disclosure label is the affordance it exists for, and it takes no second
 * meaning here.
 *
 * `defaultOpen` writes the attribute once and then leaves the element alone,
 * which is what keeps a reader's own toggle from being reverted on the next
 * render. React touches `open` only when the prop's value changes, and this
 * prop is fixed for the life of the page.
 *
 * No heading element anywhere below, and nothing interactive inside the
 * `<summary>`. The route owns the page's only h1, and a control nested in a
 * summary fights the disclosure for the same click and the same key press. The
 * check-off box lives in task-item.tsx, above this component rather than
 * inside its summary.
 */
export function CitationDisclosure({
	citation,
	rule,
	delegable = null,
	defaultOpen = false,
	window = [],
	children,
}: CitationDisclosureProps): ReactElement {
	return (
		<details open={defaultOpen} className="group border-t border-border">
			<summary
				className={cn(
					'flex list-none items-center gap-2 px-3 py-2 text-sm',
					'cursor-pointer [&::-webkit-details-marker]:hidden',
					FOCUS_RING,
				)}
			>
				<ChevronRight
					aria-hidden="true"
					className="size-4 shrink-0 text-evidence transition-transform group-open:rotate-90"
				/>
				<span className="min-w-0 flex-1">
					<span className="font-medium text-evidence">{CITATION_LABEL}</span>
					{rule !== null && (
						<span className="text-muted-foreground">{` · ${rule.name}`}</span>
					)}
				</span>
			</summary>

			<div className="space-y-3 border-t border-border px-3 py-3 text-sm">
				{/*
				 * An Artifact outlives the rule set that produced it. The daily run commits a Plan,
				 * and a Rule cited by that Plan can leave `src/seed/rules.json` before anyone reads
				 * it again, which is how a committed Citation ends up naming a Rule the site cannot
				 * resolve. Retiring three guards in #23 came within one Citation of doing exactly
				 * that. ADR 0002 makes the argument one level up: a Task that quietly loses the Rule
				 * behind it is indistinguishable from one nobody wrote. So this names the gap and
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
					<Evidence citation={citation} window={window} />
				</dl>

				{children}
			</div>
		</details>
	);
}
