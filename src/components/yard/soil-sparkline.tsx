'use client';

import type { ReactElement } from 'react';
import type { DailyAggregate } from '@/planner/plan';
import type { Citation } from '@/planner/task';
import type { ThresholdRule } from '@/rules/rule';
import type { Aggregate, Unit } from '@/weather/observation';
import { useId } from 'react';
import { VARIABLE_TEXT } from '@/components/series-text';
import { meetsThreshold } from '@/planner/threshold-rule';

/*
 * The picture ADR 0003 bought. The Artifact ships the window the Rules read so
 * a Citation can be looked at rather than taken on trust, and this is where
 * looking happens: the series, the Rule's threshold drawn across it, and the
 * day the Citation names.
 *
 * Everything here is drawn by hand rather than by a chart library. The whole
 * chart is one series, one reference line, and one marked day, which is less
 * code than configuring a library to draw it and leaves nothing between the
 * numbers in the Artifact and the pixels on the page.
 */

/*
 * The viewBox is sized near the width this actually renders at, because text
 * inside an SVG scales with the box. A 1000-unit-wide box shrunk into a phone
 * would take the labels down with it, and a threshold nobody can read is a
 * threshold that is not on the chart. Paired with the max-width below, label
 * text lands between roughly 10px and 14px across the range of screens this
 * gets read on.
 */
const VIEW = { width: 420, height: 170 };
const PLOT = { top: 22, right: 14, bottom: 30, left: 14 };
const PLOT_WIDTH = VIEW.width - PLOT.left - PLOT.right;
const PLOT_HEIGHT = VIEW.height - PLOT.top - PLOT.bottom;

/** Floored by the dataviz mark spec, which puts markers at 8px across or wider; the 2px ring below is what keeps this one legible where it crosses the line. */
const MARKER_RADIUS = 4.5;

const AGGREGATE_LABEL: Record<Aggregate, string> = {
	max: 'Daily high',
	mean: 'Daily mean',
	min: 'Daily low',
	sum: 'Daily total',
};

const BASIS_LABEL: Record<DailyAggregate['basis'], string> = {
	forecast: 'Forecast',
	observed: 'Observed',
};

const PROVENANCE_LABEL: Record<DailyAggregate['provenance'], string> = {
	measured: 'Measured',
	modeled: 'Modeled',
};

const UNIT_SUFFIX: Record<Unit, string> = {
	F: '°F',
	mm: ' mm',
	percent: '%',
};

/** Same wording the Rules route uses for a directed threshold (ADR 0005), so a reader who has seen that sentence recognizes this one. */
const DIRECTION_TEXT: Record<NonNullable<ThresholdRule['direction']>, string> = {
	falling: 'falling through',
	rising: 'rising through',
};

/** UTC and not the reader's zone: these are local calendar days already, and reparsing one in a western zone slides every label back a day. */
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function dayLabel(date: string): string {
	return DAY_FORMAT.format(Date.parse(`${date}T00:00:00Z`));
}

/** Trailing `.0` on a whole number reads like a template that got away from someone, so 55 stays 55 and 56.9 keeps its tenth. */
function amount(value: number, unit: Unit): string {
	return `${Number.isInteger(value) ? value : value.toFixed(1)}${UNIT_SUFFIX[unit]}`;
}

function round(value: number): number {
	return Number(value.toFixed(2));
}

/**
 * Which day the Citation points at. A `threshold` Citation cites a run of days
 * that already satisfied the Rule, so its `to` is the day the run completed; a
 * `threshold-projection` cites a day that has not happened yet. Every other
 * kind belongs to a Rule that never reads this series, so there is nothing here
 * for it to mark.
 */
function citedDate(citation: Citation | null): string | null {
	if (citation === null) {
		return null;
	}
	if (citation.kind === 'threshold') {
		return citation.to;
	}
	if (citation.kind === 'threshold-projection') {
		return citation.projectedDate;
	}
	return null;
}

/**
 * CONTEXT.md's Observation entry keeps a modeled grid-cell estimate apart from
 * a probe reading and says the source field is never dropped. Read off the data
 * rather than hard-coded, so the day somebody wires a probe into this yard the
 * chart stops claiming the numbers are modeled. A window carrying both says so
 * and hands the reader to the table, which names the provenance of every row.
 */
function provenanceSentence(days: DailyAggregate[]): string {
	const kinds = new Set(days.map(day => day.provenance));
	if (kinds.size > 1) {
		return 'Modeled and measured days are mixed here; the table names which is which.';
	}
	return kinds.has('measured')
		? 'Every value here is measured at a probe in the ground rather than modeled.'
		: 'Every value here is modeled: a weather grid-cell estimate, not a probe reading in this yard.';
}

interface Plotted {
	day: DailyAggregate;
	x: number;
	y: number;
}

interface BasisRun {
	basis: DailyAggregate['basis'];
	points: Plotted[];
}

/**
 * Splits the series into runs of one basis apiece, each run after the first
 * repeating its predecessor's last point. Without that repeat the line would
 * break at the boundary, and a gap in a temperature series reads as missing
 * data rather than as the end of what has actually been observed.
 *
 * The run carries its own basis rather than reading it off its first point,
 * because that first point is the borrowed one and belongs to the run before.
 *
 * Runs rather than a straight observed/forecast partition: nothing in the
 * schema promises the forecast days all sit at the end, and a partition would
 * quietly draw a lie if they ever did not.
 */
function basisRuns(plotted: Plotted[]): BasisRun[] {
	const runs: BasisRun[] = [];
	for (const point of plotted) {
		const current = runs.at(-1);
		if (current === undefined || current.basis !== point.day.basis) {
			runs.push({
				basis: point.day.basis,
				points: current === undefined ? [point] : [current.points.at(-1)!, point],
			});
			continue;
		}
		current.points.push(point);
	}
	return runs;
}

export interface SoilSparklineProps {
	/** `Plan.window` entire and unfiltered. The Rule decides which of those days belong on the chart, so handing this the whole window is correct. */
	window: DailyAggregate[];
	rule: ThresholdRule;
	/** The Citation off the Task this Rule produced, or null on a Rule that produced none. Names the day to mark; nothing else on the chart depends on it. */
	citation: Citation | null;
}

/**
 * The window's soil series with the Rule's threshold drawn across it.
 *
 * Which days it draws comes off the Rule rather than being hard-coded to soil
 * temperature at 6 cm. A second Threshold Rule at another depth would otherwise
 * get somebody else's series drawn under its own threshold line, which is the
 * one failure this component cannot be allowed to have: a threshold sitting
 * under every point says the work has fired, whatever the Task's status field
 * says.
 *
 * Nothing here distinguishes anything by colour alone. The shell is a single
 * dark monochrome theme with no accent hue to spend, so forecast days carry a
 * dashed stroke and a named legend key beside their lighter ramp step, and the
 * marked day carries a dated text label beside its marker.
 */
export function SoilSparkline({ window: planWindow, rule, citation }: SoilSparklineProps): ReactElement {
	const headingId = useId();
	const titleId = `${headingId}-title`;
	const descId = `${headingId}-desc`;

	// `toSorted` would read better and is not available: the repo compiles to
	// ES2022, and sorting the caller's array in place would be a worse bug than
	// the copy is an inconvenience.
	const days = [...planWindow]
		.filter(day => day.variable === rule.variable && day.depthCm === rule.depthCm && day.aggregate === rule.aggregate)
		.sort((left, right) => left.date.localeCompare(right.date));

	const seriesName = `${AGGREGATE_LABEL[rule.aggregate]} ${VARIABLE_TEXT[rule.variable]}${rule.depthCm === null ? '' : ` at ${rule.depthCm} cm`}`;
	const thresholdText = amount(rule.value, rule.unit);

	/*
	 * ADR 0003 names this case in as many words: a Rule that reaches past the
	 * window the Artifact ships produces a Citation the interface cannot draw. An
	 * empty SVG would present that as a chart with no weather in it, so say what
	 * happened instead—the fix is to widen the window, and somebody has to be
	 * able to tell that is what is wanted.
	 */
	if (days.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				{`This plan's window carries no ${seriesName.toLowerCase()} readings, so there is nothing to draw against the ${thresholdText} threshold.`}
			</p>
		);
	}

	/*
	 * The threshold joins the data in setting the vertical extent. Scaling to the
	 * series alone would push the reference line off the top or bottom of the
	 * plot exactly when it matters most—a yard sitting well short of 55F is the
	 * normal February case, and a chart that answers "how close are we" by hiding
	 * the line answers nothing.
	 */
	const values = days.map(day => day.value);
	const low = Math.min(...values, rule.value);
	const high = Math.max(...values, rule.value);
	// A flat series and a threshold sitting on it give a zero span, which would
	// divide every point to NaN. Two units of invented range puts the line
	// through the middle of the plot instead.
	const span = high - low || 2;
	const yMin = low - span * 0.12;
	const yMax = high + span * 0.12;

	const xFor = (index: number): number => PLOT.left + (PLOT_WIDTH * index) / Math.max(days.length - 1, 1);
	const yFor = (value: number): number => PLOT.top + (PLOT_HEIGHT * (yMax - value)) / (yMax - yMin);

	const plotted: Plotted[] = days.map((day, index) => ({ day, x: round(xFor(index)), y: round(yFor(day.value)) }));
	const runs = basisRuns(plotted);

	const thresholdY = round(yFor(rule.value));
	// Flip the label under the line when the line rides near the top of the plot,
	// rather than letting it ride up out of the viewBox.
	const thresholdLabelY = thresholdY - PLOT.top < 14 ? thresholdY + 13 : thresholdY - 5;

	const markedDate = citedDate(citation);
	const marked = plotted.find(point => point.day.date === markedDate) ?? null;
	const markedText = citation?.kind === 'threshold' ? 'Threshold met' : 'Projected';
	/*
	 * The label goes on the far side of the marker from the threshold line, then
	 * gets clamped into the plot. Either half of that alone puts text across the
	 * dashes: a fixed side collides whenever the marked day is the one that
	 * crosses, which is the day this chart is usually about.
	 */
	const markedLabelY = marked === null
		? 0
		: Math.min(Math.max(marked.y <= thresholdY ? marked.y - 11 : marked.y + 18, 12), PLOT.top + PLOT_HEIGHT);

	const observedCount = days.filter(day => day.basis === 'observed').length;
	const forecastCount = days.length - observedCount;
	// Both comparisons include the boundary. The count below goes into the chart's description while the Planner's own answer goes into the Citation, and ADR 0003 exists so that a reader can hold those two against each other, so they have to agree. Reading the boundary off one shared function is what makes them agree by construction rather than by coincidence.
	const meetingCount = values.filter(value => meetsThreshold(value, rule)).length;
	const sideWords = rule.comparison === 'gte' ? 'at or above it' : 'at or below it';

	/*
	 * ADR 0005 counts a directed Rule's run only where the day before it sat
	 * strictly on the far side of the value, so that day—not the day count—is
	 * what fired the Rule. "Strictly" is load-bearing and stays in the sentence:
	 * a description that reads inclusive states a looser firing condition than
	 * the Planner applies, which is the mismatch ADR 0003 ships this window to
	 * let a reader catch. A Rule naming no direction is still judged on the run
	 * alone, so its sentence is untouched.
	 */
	const thresholdSentence = rule.direction === null
		? `The rule's threshold is ${thresholdText} held for ${rule.consecutiveDays} consecutive days; ${meetingCount} of these ${days.length} days sit ${sideWords}.`
		: `The rule fires on a crossing, so a run of ${rule.consecutiveDays} consecutive days ${DIRECTION_TEXT[rule.direction]} ${thresholdText} counts only where the day before it sat strictly on the far side. For context, ${meetingCount} of these ${days.length} days sit ${sideWords}.`;

	const description = [
		`${observedCount} observed ${observedCount === 1 ? 'day' : 'days'} and ${forecastCount} forecast, running from ${amount(Math.min(...values), rule.unit)} to ${amount(Math.max(...values), rule.unit)}.`,
		thresholdSentence,
		marked === null ? null : `${dayLabel(marked.day.date)} is marked, the day this task's citation names.`,
	].filter(sentence => sentence !== null).join(' ');

	return (
		<figure className="space-y-2">
			<figcaption id={headingId} className="text-sm font-medium text-foreground">
				{`${seriesName} against the ${thresholdText} threshold`}
			</figcaption>

			<svg
				viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
				className="h-auto w-full max-w-[520px] text-foreground"
				role="img"
				aria-labelledby={`${titleId} ${descId}`}
			>
				<title id={titleId}>{`${seriesName} against the ${thresholdText} threshold`}</title>
				<desc id={descId}>{description}</desc>

				{/* The one dashed thing on the chart, and the reason no gridline is
				    drawn at all: dashing reads as "threshold", so nothing else may wear
				    it here. */}
				<line
					data-role="threshold"
					x1={PLOT.left}
					x2={PLOT.left + PLOT_WIDTH}
					y1={thresholdY}
					y2={thresholdY}
					className="stroke-muted-foreground"
					strokeWidth={1.5}
					strokeDasharray="5 4"
				/>
				<text x={PLOT.left} y={thresholdLabelY} className="fill-muted-foreground" fontSize={11}>
					{`${thresholdText} threshold`}
				</text>

				{runs.map(run => (
					<polyline
						key={`${run.basis}-${run.points.at(-1)!.day.date}`}
						data-basis={run.basis}
						points={run.points.map(point => `${point.x},${point.y}`).join(' ')}
						fill="none"
						strokeWidth={2}
						strokeLinecap="round"
						strokeLinejoin="round"
						// Two channels, never the ramp step alone. CONTEXT.md's Threshold
						// Rule entry says a forecast can never fire one, so a reader who
						// cannot tell the forecast days apart cannot check the citation.
						className={run.basis === 'forecast' ? 'stroke-muted-foreground' : 'stroke-foreground'}
						strokeDasharray={run.basis === 'forecast' ? '4 3' : undefined}
					/>
				))}

				{marked !== null && (
					<>
						{/* Drops the marker onto the date axis, so the marked day can be
						    read off the bottom of the plot rather than guessed at. */}
						<line
							x1={marked.x}
							x2={marked.x}
							y1={marked.y}
							y2={PLOT.top + PLOT_HEIGHT}
							className="stroke-border"
							strokeWidth={1}
						/>
						<circle
							data-role="marked-day"
							cx={marked.x}
							cy={marked.y}
							r={MARKER_RADIUS}
							className="fill-foreground stroke-background"
							strokeWidth={2}
						/>
						<text
							data-role="marked-day-label"
							x={marked.x}
							y={markedLabelY}
							textAnchor={marked.x > PLOT.left + PLOT_WIDTH * 0.75 ? 'end' : marked.x < PLOT.left + PLOT_WIDTH * 0.25 ? 'start' : 'middle'}
							className="fill-foreground font-medium"
							fontSize={11}
						>
							{`${markedText} ${dayLabel(marked.day.date)}`}
						</text>
					</>
				)}

				{/* Both ends of the span only. The table below carries every date. */}
				<text x={PLOT.left} y={VIEW.height - 9} className="fill-muted-foreground" fontSize={11}>
					{dayLabel(days[0]!.date)}
				</text>
				<text x={PLOT.left + PLOT_WIDTH} y={VIEW.height - 9} textAnchor="end" className="fill-muted-foreground" fontSize={11}>
					{dayLabel(days.at(-1)!.date)}
				</text>
			</svg>

			{/* Words, not just two shades of grey. The legend is the channel that
			    survives a phone in the sun and a reader who cannot see the ramp step. */}
			<ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
				{observedCount > 0 && (
					<li className="flex items-center gap-1.5">
						<svg viewBox="0 0 20 2" aria-hidden="true" className="w-5 text-foreground">
							<line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeWidth={2} />
						</svg>
						Observed
					</li>
				)}
				{forecastCount > 0 && (
					<li className="flex items-center gap-1.5">
						<svg viewBox="0 0 20 2" aria-hidden="true" className="w-5 text-muted-foreground">
							<line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeWidth={2} strokeDasharray="4 3" />
						</svg>
						Forecast
					</li>
				)}
			</ul>

			<p className="text-xs text-muted-foreground">{provenanceSentence(days)}</p>

			{/* The citation can name a day outside the window the Artifact ships—ADR
			    0003's own consequence. Saying so beats a chart that silently
			    marks nothing and looks finished. */}
			{markedDate !== null && marked === null && (
				<p className="text-xs text-muted-foreground">
					{`The cited day, ${dayLabel(markedDate)}, falls outside the window this plan carries, so it is not marked above.`}
				</p>
			)}

			{/* Native details because the plan fixes it as how things expand here, and
			    no collapsible component is installed. Every value on the chart is
			    reachable as text from inside it. */}
			<details className="text-xs">
				<summary className="cursor-pointer text-muted-foreground">
					{`Show these ${days.length} days as a table`}
				</summary>
				<div className="mt-2 overflow-x-auto">
					<table className="w-full text-left tabular-nums">
						<caption className="sr-only">{description}</caption>
						<thead>
							<tr className="border-b border-border text-muted-foreground">
								<th scope="col" className="py-1 pr-3 font-medium">Day</th>
								<th scope="col" className="py-1 pr-3 font-medium">{AGGREGATE_LABEL[rule.aggregate]}</th>
								<th scope="col" className="py-1 pr-3 font-medium">Basis</th>
								<th scope="col" className="py-1 font-medium">Provenance</th>
							</tr>
						</thead>
						<tbody>
							{days.map(day => (
								<tr key={day.date} className="border-b border-border/60">
									<th scope="row" className="py-1 pr-3 font-normal">{dayLabel(day.date)}</th>
									<td className="py-1 pr-3">{amount(day.value, day.unit)}</td>
									<td className="py-1 pr-3">{BASIS_LABEL[day.basis]}</td>
									<td className="py-1">{PROVENANCE_LABEL[day.provenance]}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</figure>
	);
}
