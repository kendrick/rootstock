import type { ReactElement } from 'react';
import type { Band, RuleStanding } from './waiting';
import type { AfterLink } from '@/components/rule-summary';
import type { Plan } from '@/planner/plan';
import type { Rule } from '@/rules/rule';
import { RuleSummary } from '@/components/rule-summary';
import { rankRules } from './waiting';

export interface RuleListProps {
	rules: Rule[];
	plan: Plan;
}

/**
 * The band headings, in the order a reader asks for them.
 *
 * Each says what the band means rather than naming a state, because "waiting"
 * alone leaves a reader guessing whether the yard is broken or simply out of
 * season.
 */
const BANDS: readonly { band: Band; label: string; note: string }[] = [
	{ band: 'fired', label: 'Fired this week', note: 'These produced work on the current Plan.' },
	{ band: 'approaching', label: 'Approaching', note: 'The Planner expects these to be satisfied. A forecast can be revised, so nothing here has fired.' },
	{ band: 'waiting', label: 'Waiting', note: 'Out of season, waiting on a reading, or not yet due. Every one of them is still in the rule set.' },
	{ band: 'guard', label: 'Guards', note: 'These create no work. They hold other work back and say what would release it.' },
];

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

function RuleRow({ standing, after }: { standing: RuleStanding; after: AfterLink | null }): ReactElement {
	const { rule, waitingOn, touched } = standing;

	return (
		<li id={ruleAnchor(rule.id)} className="grid scroll-mt-4 border-t-2 border-rule first:border-t-0 lg:grid-cols-[minmax(0,1fr)_15rem]">

			{/* RuleSummary carries the whole record: the window or the condition, the
			    published range, the product label, the source and the delegability. The
			    bands decide the order of the page and change nothing about what a Rule
			    is allowed to say about itself. */}
			<div className="min-w-0 px-3 py-3">
				<RuleSummary rule={rule} hideRegion asHeading showKind after={after} />
			</div>

			{/* Below lg the status sits under the record, divided by a faint rule so
			    the row's heavy outline still holds both. It's a reading, so it prints
			    in ink; DESIGN.md keeps stamp red for recorded work. */}
			<div className="space-y-1 border-t border-rule-faint px-3 py-3 text-foreground lg:border-t-0 lg:border-l-2 lg:border-rule">
				{touched.length === 0
					? (
							<p className="font-mono text-evidence text-pretty">
								<span className="sr-only">Status: </span>
								{waitingOn}
							</p>
						)
					: (
							// A Task's title on a line of its own, so a long one wraps at a
							// space; run on after the verb, it breaks at the hyphen in
							// "pre-emergent".
							<div className="font-mono text-evidence">
								<p>
									<span className="sr-only">Status: </span>
									{`${rule.kind === 'guard' && rule.effect === 'defer' ? 'Holding' : 'Marking'}:`}
								</p>
								<ul>
									{touched.map(title => <li key={title}>{title}</li>)}
								</ul>
							</div>
						)}
				{rule.kind === 'guard' && rule.effect === 'defer' && standing.inCurrentPlan && (
					<p className="text-note text-pretty text-muted">{`Released ${lowerFirst(rule.release)}`}</p>
				)}
			</div>
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
export function RuleList({ rules, plan }: RuleListProps): ReactElement {
	const ranked = rankRules(rules, plan);
	const names = new Map(rules.map(rule => [rule.id, rule.name]));

	// Every Rule shares the yard's one Region, which the ticket head already
	// prints, so `hideRegion` keeps it off each row and the page adds no third copy.
	return (
		<div className="space-y-8">

			{BANDS.map(({ band, label, note }) => {
				const inBand = ranked.filter(standing => standing.band === band);

				// A band with nothing in it is not drawn. An empty heading over an empty
				// list reads as a rendering failure rather than as a quiet week.
				if (inBand.length === 0) {
					return null;
				}

				return (
					<section key={band} aria-labelledby={`band-${band}`} className="space-y-3">
						<div className="flex flex-wrap items-baseline justify-between gap-x-4 border-t-2 border-rule pt-3">
							<h2
								id={`band-${band}`}
								className="font-display text-heading font-extrabold tracking-wider text-foreground uppercase"
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
								/>
							))}
						</ul>
					</section>
				);
			})}
		</div>
	);
}
