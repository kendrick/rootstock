import type { ReactElement } from 'react';
import type { RuleTicketLine } from './ticket-lines';
import type { RuleStanding } from './waiting';
import type { AfterLink } from '@/components/rule-summary';
import type { Occurrence } from '@/planner/occurrence';
import type { Plan } from '@/planner/plan';
import type { Rule } from '@/rules/rule';
import { RuleSummary } from '@/components/rule-summary';
import { FOCUS_RING } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { seedOccurrences, seedPlants } from '@/seed';
import { anchorFor, recordedDay } from './anchor';
import { bandAnchor, drawnBands } from './bands';
import { ticketLinesFor } from './ticket-lines';
import { groupChecks, intervalText, rankRules } from './waiting';

export interface RuleListProps {
	rules: Rule[];
	plan: Plan;
	/**
	 * Defaults to the committed history, the record the daily run plans from
	 * (ADR 0006), so the line agrees with the Plan on the page rather than with
	 * whatever this browser's Store holds.
	 */
	occurrences?: readonly Occurrence[];
}

const LINK = cn('underline underline-offset-4', FOCUS_RING);

// Clears the band index, which sticks to the top of the column from sm. On a
// phone it doesn't stick, so the jump needs only a little air.
const JUMP_MARGIN = 'scroll-mt-4 sm:scroll-mt-16';

/** The in-page id a Rule's row carries, so "Measured from" can link to it. */
function ruleAnchor(ruleId: string): string {
	return `rule-${ruleId}`;
}

/** The Rule a follow-up is measured from, by name and as a link to its row. Null where the id names no Rule on the page. */
function afterLink(rule: Rule, names: Map<string, string>): AfterLink | null {
	if (rule.kind !== 'cadence' || rule.after === null) {
		return null;
	}
	const name = names.get(rule.after.ruleId);

	return name === undefined ? null : { name, href: `#${ruleAnchor(rule.after.ruleId)}` };
}

function lowerFirst(text: string): string {
	return text.charAt(0).toLowerCase() + text.slice(1);
}

function plantName(plantId: string | null): string {
	return plantId === null ? 'the whole yard' : seedPlants.find(plant => plant.id === plantId)?.name ?? plantId;
}

/**
 * Where a fired Rule's work sits on This Week, by the line number the ticket
 * prints. Plain links, not next/link: a client-side hop doesn't update
 * `:target`, so This Week's row would never mark itself.
 */
function TicketLines({ lines }: { lines: readonly RuleTicketLine[] }): ReactElement | null {
	if (lines.length === 0) {
		return null;
	}
	// With one Plant the For row already names it. With several, each line says
	// whose it is, or the reader can't tell which link to follow.
	const named = new Set(lines.map(line => line.plantId)).size > 1;

	return (
		<p className="text-pretty">
			{'On this week\'s ticket: '}
			{lines.map((line, index) => (
				<span key={line.href}>
					{index > 0 && ', '}
					<a href={line.href} className={cn(LINK, 'whitespace-nowrap')}>{line.label}</a>
					{named && ` for ${plantName(line.plantId)}`}
				</span>
			))}
		</p>
	);
}

function RuleRow({ standing, after, lines, anchor }: { standing: RuleStanding; after: AfterLink | null; lines: readonly RuleTicketLine[]; anchor: Occurrence | null }): ReactElement {
	const { rule, waitingOn, checks } = standing;

	// The status is the one line the band changes, so it sits straight under the
	// name, ahead of the record, where a reader scanning the page lands on it
	// first. It's a reading, so it prints in ink; DESIGN.md keeps stamp red for
	// recorded work.
	const status = (
		<div data-rule-status className="space-y-1 border-y border-rule-faint py-2 font-mono text-evidence text-foreground">
			{rule.kind !== 'guard' || checks.length === 0
				? (
						<p className="text-pretty">
							<span className="sr-only">Status: </span>
							{waitingOn}
						</p>
					)
				: groupChecks(checks).map(({ label, titles }) => (
						// Each Task title on a line of its own, so a long one wraps at a
						// space; run on after the label, it breaks at the hyphen in
						// "pre-emergent".
						<div key={label}>
							<p>
								<span className="sr-only">Status: </span>
								{label}
							</p>
							<ul>
								{titles.map(title => <li key={title}>{title}</li>)}
							</ul>
						</div>
					))}
			{standing.band === 'fired' && <TicketLines lines={lines} />}
			{/* A follow-up counts from the Rule it follows, and the season line never
			    says so. The record's "Measured from" row names the same Rule; this
			    line puts it where a reader asking why the Rule is quiet looks. Once
			    that Rule's work is recorded, "Waits on" would call it outstanding, so
			    the line gives the interval and the day it counts from instead. */}
			{standing.band === 'waiting' && after !== null && rule.kind === 'cadence' && (
				<p className="text-pretty">
					{anchor === null ? 'Waits on ' : `Due ${intervalText(rule)} after `}
					<a href={after.href} className={LINK}>{after.name}</a>
					{anchor !== null && `, recorded ${recordedDay(anchor)}`}
				</p>
			)}
			{/* The release condition the Planner copied onto each Deferral, not the
			    Guard's current text, which may have changed since. */}
			{[...new Set(checks.map(check => check.releaseWhen).filter(release => release !== null))].map(release => (
				<p key={release} className="font-sans text-note text-pretty text-muted">{`Released ${lowerFirst(release)}`}</p>
			))}
		</div>
	);

	return (
		<li id={ruleAnchor(rule.id)} className={cn(JUMP_MARGIN, 'border-t-2 border-rule px-3 py-3 first:border-t-0')}>
			{/* RuleSummary carries the whole record: the window or the condition, the
			    published range, the product label, the source and the delegability. The
			    bands decide the order of the page and change nothing about what a Rule
			    is allowed to say about itself. */}
			<RuleSummary rule={rule} hideRegion asHeading showKind showPlants after={after} status={status} />
		</li>
	);
}

/**
 * Every Rule the yard holds, ranked by how close it is to producing work.
 *
 * #69 grouped this route by the four Rule kinds and joined each to the current
 * Plan, which put the taxonomy in charge of the page. The question a reader
 * actually brings is what is next, so the bands answer that and the kind is
 * printed in words among each row's marks. Every Rule is still here, and so is
 * every kind.
 *
 * The ranking invents nothing. Firing and approaching are read off the Plan, so
 * the Planner remains the only thing claiming either. A Window Rule's distance
 * is arithmetic on dates it carries itself. A Threshold Rule's line puts the
 * last observed reading beside the value the Rule wants, which is two committed
 * numbers rather than a guess about when they will meet.
 */
export function RuleList({ rules, plan, occurrences = seedOccurrences }: RuleListProps): ReactElement {
	const ranked = rankRules(rules, plan);
	const names = new Map(rules.map(rule => [rule.id, rule.name]));

	// Every Rule shares the yard's one Region, which the ticket head already
	// prints, so `hideRegion` keeps it off each row and the page adds no third copy.
	return (
		<div className="space-y-8">
			{/* A band with nothing in it is not drawn. An empty heading over an empty
			    list reads as a rendering failure rather than as a quiet week. */}
			{drawnBands(ranked).map(({ band, label, note }) => {
				const inBand = ranked.filter(standing => standing.band === band);

				return (
					<section key={band} aria-labelledby={bandAnchor(band)} className="space-y-3">
						<div className="flex flex-wrap items-baseline justify-between gap-x-4 border-t-2 border-rule pt-3">
							<h2
								id={bandAnchor(band)}
								className={cn(JUMP_MARGIN, 'font-display text-heading font-extrabold tracking-wider text-foreground uppercase')}
							>
								{label}
							</h2>
							<span className="font-mono text-evidence text-muted">
								{inBand.length}
								<span className="sr-only">{inBand.length === 1 ? ' Rule' : ' Rules'}</span>
							</span>
						</div>

						<p className="max-w-prose text-note text-pretty text-muted">{note}</p>

						<ul className="border-2 border-rule">
							{inBand.map(standing => (
								<RuleRow
									key={standing.rule.id}
									standing={standing}
									after={afterLink(standing.rule, names)}
									lines={ticketLinesFor(standing.rule.id, plan.tasks)}
									anchor={anchorFor(standing.rule, occurrences, seedPlants)}
								/>
							))}
						</ul>
					</section>
				);
			})}
		</div>
	);
}
