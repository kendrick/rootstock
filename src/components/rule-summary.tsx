import type { ReactElement, ReactNode } from 'react';
import type { Rule, TagPolicy, ThresholdRule, WindowRule } from '@/rules/rule';
import { ExternalLink } from 'lucide-react';
import { AGGREGATE_TEXT, formatValue, VARIABLE_TEXT } from '@/components/series-text';
import { SourceBadge } from '@/components/source-badge';
import { cn } from '@/lib/utils';
import { MONTHS } from '@/planner/dates';
import { isDelegable } from '@/planner/delegation';
import { seedTagPolicy } from '@/seed';

const COMPARISON_TEXT: Record<ThresholdRule['comparison'], string> = {
	gte: 'at or above',
	lte: 'at or below',
};

// A directed Rule is evidenced by a Crossing (ADR 0005), so its sentence says
// so in those words rather than the undirected "at or above"/"at or below",
// which describes a level with no claim about which way the series got there.
const DIRECTION_TEXT: Record<NonNullable<ThresholdRule['direction']>, string> = {
	falling: 'falling through',
	rising: 'rising through',
};

/**
 * MM-DD is deliberately yearless—rule.ts keeps the fall pre-emergent window
 * attached to every September rather than to 2026—so this splits the string
 * instead of going through `Date`. A parsed Date would have to borrow a year,
 * and a borrowed year plus the reader's timezone is how "August 20" renders as
 * August 19 for somebody west of the yard.
 */
function formatMonthDay(monthDay: string): string {
	const [month, day] = monthDay.split('-');
	const name = month === undefined ? undefined : MONTHS[Number(month) - 1];

	return name === undefined || day === undefined ? monthDay : `${name} ${Number(day)}`;
}

function Row({ term, children }: { term: string; children: ReactNode }): ReactElement {
	return (
		<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
			<dt className="shrink-0 text-muted-foreground">{term}</dt>
			<dd className="flex flex-wrap items-center gap-x-2 gap-y-1 text-foreground">{children}</dd>
		</div>
	);
}

function WindowRows({ rule }: { rule: WindowRule }): ReactElement {
	return (
		<Row term="Window">
			{`${formatMonthDay(rule.start)} through ${formatMonthDay(rule.end)}`}
		</Row>
	);
}

function thresholdSentence(rule: ThresholdRule): string {
	const depth = rule.depthCm === null ? '' : ` at ${rule.depthCm} cm`;
	const run = rule.consecutiveDays === 1
		? 'for one day'
		: `for ${rule.consecutiveDays} consecutive days`;
	// Named for the slot it fills rather than for either branch, because a
	// directed Rule puts a Crossing here where an undirected one puts a bare
	// comparison. CONTEXT.md's Threshold Rule entry rules out calling it the
	// condition.
	const valueWords = rule.direction === null
		? COMPARISON_TEXT[rule.comparison]
		: DIRECTION_TEXT[rule.direction];

	return `Daily ${AGGREGATE_TEXT[rule.aggregate]} ${VARIABLE_TEXT[rule.variable]}${depth}, `
		+ `${valueWords} ${formatValue(rule.value, rule.unit)} ${run}`;
}

function ThresholdRows({ rule }: { rule: ThresholdRule }): ReactElement {
	return (
		<>
			<Row term="Fires when">{thresholdSentence(rule)}</Row>
			{/*
			 * Same shape as CadenceRows' season row: both fence a Rule to part of
			 * the year through the identical seasonSchema, and ADR 0005 gives this
			 * one a second job besides—keeping a January warm spell from reading as
			 * the spring crossing it isn't.
			 */}
			{rule.season !== null && (
				<Row term="Season">
					{`${formatMonthDay(rule.season.start)} through ${formatMonthDay(rule.season.end)}`}
				</Row>
			)}
			{/*
			 * The published range sits beside the single number the yard acts on,
			 * never in place of it. rule.ts makes the case: AgriLife printed 50 to
			 * 55F and this yard picked 55, and that narrowing is a local judgment.
			 * Showing only the acted-on number hides the judgment; showing only the
			 * range hides what will actually happen. The range carries its own
			 * SourceBadge because the extension sheet that printed it is frequently
			 * not the same document as the Rule's own source.
			 */}
			{rule.published !== null && (
				<Row term="Published range">
					<span>{`${rule.published.low} to ${formatValue(rule.published.high, rule.unit)}`}</span>
					<SourceBadge source={rule.published.source} />
				</Row>
			)}
		</>
	);
}

function CadenceRows({ rule }: { rule: Extract<Rule, { kind: 'cadence' }> }): ReactElement {
	const interval = rule.everyDays.min === rule.everyDays.max
		? `${rule.everyDays.min} days`
		: `${rule.everyDays.min} to ${rule.everyDays.max} days`;

	return (
		<>
			<Row term="Every">{interval}</Row>
			{rule.season !== null && (
				<Row term="Season">
					{`${formatMonthDay(rule.season.start)} through ${formatMonthDay(rule.season.end)}`}
				</Row>
			)}
			{/*
			 * CONTEXT.md's Anchor: a follow-up measures its interval from the Rule it
			 * follows, not from itself. The ID is rendered raw because this component
			 * is handed one Rule and has no rule set to resolve a name against—and
			 * accepting one just to prettify a string would put a second source of
			 * Rules into a view that only describes the one it was given.
			 */}
			{rule.after !== null && (
				<Row term="Measured from">
					<code className="font-mono">{rule.after.ruleId}</code>
				</Row>
			)}
		</>
	);
}

/**
 * ADR 0002 gives a Guard two effects and no third, so the words here are
 * exhaustive on purpose: a reader who sees neither sentence is looking at an
 * effect nobody decided the consequences of. Neither sentence carries the
 * Guard's own `release` or `text`—those describe what happened to one Task,
 * and this component describes the Rule in the abstract. The deferred section
 * renders `releaseWhen` where a reader is actually looking at held work.
 */
const GUARD_EFFECT_TEXT: Record<Extract<Rule, { kind: 'guard' }>['effect'], string> = {
	defer: 'Defers the Task until its release condition is met',
	annotate: 'Annotates the Task, and holds no work back',
};

export interface RuleSummaryProps {
	rule: Rule;
	/**
	 * The Planner's stamped answer, when a Task supplied one. Null or omitted and
	 * the component falls back to isDelegable(rule, tagPolicy).
	 */
	delegable?: boolean | null;
	tagPolicy?: TagPolicy;
	/**
	 * Omits the Region row. Every Rule in this yard shares one Region, so the
	 * Rules route—the only caller passing this—renders it once for the page
	 * and hides the per-Rule copy rather than repeating it once per Rule.
	 * Defaults to false, which keeps every other caller's rendered shape as it was.
	 */
	hideRegion?: boolean;
	/**
	 * Whether the committed Artifact's Plan already used this Rule: it produced
	 * a Task, or—for a Guard—it placed a Deferral or Annotation on one. Omitted
	 * renders nothing extra, which is what keeps this additive for the callers
	 * that render a Rule with no Plan in hand.
	 */
	inCurrentPlan?: boolean;
	/**
	 * Renders the Rule's name as an `<h3>` instead of a `<span>`, so a screen
	 * reader gets a heading landmark for the name that is actually on screen,
	 * rather than a second, invisible element carrying the same text next to
	 * it. Defaults to false, which keeps every other caller's rendered shape—
	 * This Week's `<details>` and the Yard plant sheet compose this at depths
	 * an `<h3>` here would not suit.
	 */
	asHeading?: boolean;
}

/**
 * What a Rule says, with no date on it. The dated evidence behind a particular
 * Task is a Citation and lives in `citation.tsx`, which composes this; the
 * split is what lets the Rules route render the same summary for a Rule that
 * produced no Task this week—including a Guard, which never produces one at
 * all.
 *
 * No heading element anywhere below unless `asHeading` says otherwise. This
 * renders inside a `<details>` on the This Week route and inside a list on
 * the Rules route, so its depth is set by whoever composed it; a heading
 * fixed at one level here would land right in one place and wrong in the
 * other. The route owns the page's only h1.
 */
export function RuleSummary({
	rule,
	delegable = null,
	tagPolicy = seedTagPolicy,
	hideRegion = false,
	inCurrentPlan = false,
	asHeading = false,
}: RuleSummaryProps): ReactElement {
	const NameTag = asHeading ? 'h3' : 'span';
	// The stamped flag wins when there is one. `isDelegable` has already been
	// applied to it by the Planner, and CONTEXT.md's Delegable entry says tag
	// policy only ever narrows—so the stamp is the narrowed answer, and asking
	// again here would be the same question with a second chance to answer it
	// differently. The fallback exists for the Rules route, which renders Rules
	// that produced no Task and so has no stamp to read.
	const canDelegate = typeof delegable === 'boolean' ? delegable : isDelegable(rule, tagPolicy);

	return (
		<div className="space-y-2 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<NameTag className="font-medium text-foreground">{rule.name}</NameTag>
				<SourceBadge source={rule.source} />
			</div>

			<dl className="space-y-1">
				{!hideRegion && (
					<Row term="Region">
						{`${rule.region.name} · Zone ${rule.region.hardinessZone}`}
					</Row>
				)}

				{rule.kind === 'window' && <WindowRows rule={rule} />}
				{rule.kind === 'threshold' && <ThresholdRows rule={rule} />}
				{rule.kind === 'cadence' && <CadenceRows rule={rule} />}
				{rule.kind === 'guard' && <Row term="Effect">{GUARD_EFFECT_TEXT[rule.effect]}</Row>}

				{/*
				 * Reached through `productLabel` and never through the chemical tag.
				 * `ruleSchema` already refuses to parse a Rule tagged chemical without
				 * one, so the field is the answer; a tag test here would be a second,
				 * weaker copy of that policy living in a view, and ADR 0002 is blunt
				 * about which way a view-layer string match fails.
				 *
				 * The link is the whole of it. rule.ts is explicit that this app never
				 * restates a mixing rate or a re-entry interval: the label is the legal
				 * instruction and a paraphrase of it goes stale the day the formulation
				 * changes.
				 */}
				{rule.productLabel !== null && (
					<Row term="Product label">
						<a
							href={rule.productLabel.url}
							target="_blank"
							rel="noopener noreferrer"
							className={cn(
								'inline-flex items-center gap-1.5 rounded-sm underline underline-offset-4 outline-none',
								'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
							)}
						>
							Read the manufacturer&rsquo;s label
							<ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
						</a>
					</Row>
				)}
			</dl>

			{/* Printed marks in a line, not badges. A ticket has no rounded chrome and
			    no icon system, so each of these states itself in type. */}
			<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-display text-label tracking-widest uppercase">
				{/*
				 * A Guard reaching a reader outside a Task—on the Rules route, say—looks
				 * exactly like a Rule that asks for work unless it says otherwise on its
				 * face. CONTEXT.md's Guard entry is the sentence.
				 */}
				{rule.kind === 'guard' && (
					<span className="text-muted">Guard &middot; creates no work</span>
				)}

				{/*
				 * The word carries this, and nothing else does. A reader with a
				 * colour-vision deficiency has to be able to tell delegable work from work
				 * that stays with the owner, and this is the flag that decides whether a
				 * Task can be handed to somebody else while the owner is away. It used to
				 * be a word beside a glyph; the glyph is gone, which leaves the word
				 * load-bearing on its own and means it must never become a colour.
				 */}
				<span className={canDelegate ? 'text-muted' : 'font-bold text-foreground'}>
					{canDelegate ? 'Delegable' : 'Not delegable'}
				</span>

				{/*
				 * The join the Rules route would otherwise be missing: the Artifact names
				 * every Rule that fired, and without this nothing here said which of those
				 * Rules it was. A Guard never produces a Task itself, so it answers a
				 * different question—whether it reached one through a Deferral or an
				 * Annotation—rather than restating the Task's own evidence.
				 */}
				{inCurrentPlan && (
					<span className="font-bold text-foreground">
						{rule.kind === 'guard' ? 'Acted on a Task this week' : 'Produced a Task this week'}
					</span>
				)}
			</div>
		</div>
	);
}
