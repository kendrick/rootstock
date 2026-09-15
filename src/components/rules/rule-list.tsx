import type { ReactElement } from 'react';
import type { Band, RuleStanding } from './waiting';
import type { Plan } from '@/planner/plan';
import type { Rule } from '@/rules/rule';
import { RuleSummary } from '@/components/rule-summary';
import { cn } from '@/lib/utils';
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
	{ band: 'fired', label: 'Firing now', note: 'These produced work on the current Plan.' },
	{ band: 'approaching', label: 'Approaching', note: 'The Planner expects these to be satisfied. A forecast can be revised, so nothing here has fired.' },
	{ band: 'waiting', label: 'Waiting', note: 'Out of season, under their threshold, or not yet due. Every one of them is still in the rule set.' },
	{ band: 'guard', label: 'Guards', note: 'These create no work. They hold other work back and say what would release it.' },
];

/**
 * The one-letter mark for a Rule's kind, and the legend that explains it.
 *
 * The mark keeps the four kinds legible without letting the taxonomy organise
 * the page. On its own it is a letter nobody can decode, so the legend below
 * ships with it: a screen reader already gets the full name from the row, and a
 * sighted reader needs somewhere to look it up once.
 */
const KINDS: readonly { kind: Rule['kind']; mark: string; label: string }[] = [
	{ kind: 'window', mark: 'W', label: 'Window' },
	{ kind: 'threshold', mark: 'T', label: 'Threshold' },
	{ kind: 'cadence', mark: 'C', label: 'Cadence' },
	{ kind: 'guard', mark: 'G', label: 'Guard' },
];

const KIND_MARK: Record<Rule['kind'], string> = {
	window: 'W',
	threshold: 'T',
	cadence: 'C',
	guard: 'G',
};

/**
 * The key to the marks in the first column.
 *
 * `aria-hidden`, because every row already names its own kind in text. A screen
 * reader reading this would be learning a cipher it never has to decode.
 */
function KindLegend(): ReactElement {
	return (
		<dl
			aria-hidden="true"
			className="flex flex-wrap border-2 border-rule font-display text-label tracking-widest uppercase"
		>
			{KINDS.map(({ kind, mark, label }) => (
				<div key={kind} className="flex items-center gap-2 border-r-2 border-rule px-3 py-1.5 last:border-r-0">
					<dt className="font-extrabold text-foreground">{mark}</dt>
					<dd className="text-muted">{label}</dd>
				</div>
			))}
		</dl>
	);
}

function RuleRow({ standing }: { standing: RuleStanding }): ReactElement {
	const { rule, band, waitingOn, inCurrentPlan } = standing;

	return (
		<li className="grid grid-cols-[2.5rem_minmax(0,1fr)] border-t-2 border-rule first:border-t-0 lg:grid-cols-[2.5rem_minmax(0,1fr)_15rem]">
			<span
				// The kind is a printed mark on the row rather than the heading the page
				// is built from. Its full name rides in the accessible text beside it,
				// because a lone "W" tells a screen reader nothing.
				className="flex items-start justify-center border-r-2 border-rule px-2 py-3 font-display text-body leading-none font-extrabold"
			>
				<span aria-hidden="true">{KIND_MARK[rule.kind]}</span>
				<span className="sr-only">{`${rule.kind} rule`}</span>
			</span>

			{/* RuleSummary carries the whole record: the window or the condition, the
			    published range, the product label, the source and the delegability. The
			    bands decide the order of the page and change nothing about what a Rule
			    is allowed to say about itself. */}
			<div className="min-w-0 px-3 py-3">
				<RuleSummary rule={rule} hideRegion asHeading inCurrentPlan={inCurrentPlan} />
			</div>

			<div
				className={cn(
					'border-t-2 border-rule px-3 py-3 font-mono text-detail lg:border-t-0 lg:border-l-2',
					band === 'fired' ? 'text-accent' : 'text-muted',
				)}
			>
				{waitingOn}
			</div>
		</li>
	);
}

/**
 * Every Rule the yard holds, ranked by how close it is to producing work.
 *
 * #69 grouped this route by the four Rule kinds and joined each to the current
 * Plan, which put the taxonomy in charge of the page. The question a reader
 * actually brings is what is next, so the bands answer that and the kind rides
 * along as a mark on the row. Nothing was removed: every Rule the old page
 * listed is still here, and the kinds are still legible.
 *
 * The ranking invents nothing. Firing and approaching are read off the Plan, so
 * the Planner remains the only thing claiming either. A Window Rule's distance
 * is arithmetic on dates it carries itself. A Threshold Rule's line puts the
 * last observed reading beside the value the Rule wants, which is two committed
 * numbers rather than a guess about when they will meet.
 */
export function RuleList({ rules, plan }: RuleListProps): ReactElement {
	const ranked = rankRules(rules, plan);

	const [firstRule] = rules;

	return (
		<div className="space-y-8">
			{/* Every Rule in this yard shares one Region, so it is stated once for the
			    page and `hideRegion` keeps it off each row. */}
			{firstRule !== undefined && (
				<p className="font-display text-label tracking-widest text-muted uppercase">
					{`${firstRule.region.name} · Zone ${firstRule.region.hardinessZone}`}
				</p>
			)}

			<KindLegend />

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
								className={cn(
									'font-display text-label font-bold tracking-widest uppercase',
									band === 'fired' ? 'text-accent' : 'text-foreground',
								)}
							>
								{label}
							</h2>
							<span className="font-mono text-detail text-muted">{inBand.length}</span>
						</div>

						<p className="max-w-prose font-mono text-detail text-muted">{note}</p>

						<ul className="border-2 border-rule">
							{inBand.map(standing => <RuleRow key={standing.rule.id} standing={standing} />)}
						</ul>
					</section>
				);
			})}
		</div>
	);
}
