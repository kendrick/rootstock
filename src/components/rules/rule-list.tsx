import type { ReactElement } from 'react';
import type { Plan } from '@/planner/plan';
import type { Rule } from '@/rules/rule';
import { RuleSummary } from '@/components/rule-summary';

export interface RuleListProps {
	rules: Rule[];
	/**
	 * The committed Artifact's Plan, so each Rule can say whether the current
	 * run actually used it: a fired, approaching, or deferred Task for a
	 * task-creating Rule, or a Deferral or Annotation naming a Guard.
	 */
	plan: Plan;
}

const KIND_TITLES: Record<Exclude<Rule['kind'], 'guard'>, string> = {
	window: 'Window rules',
	threshold: 'Threshold rules',
	cadence: 'Cadence rules',
};

const KIND_ORDER = ['window', 'threshold', 'cadence'] as const;

/** Every Rule id a Task in the Plan names, whatever the Task's status. */
function firedRuleIds(plan: Plan): ReadonlySet<string> {
	return new Set(plan.tasks.map(task => task.ruleId));
}

/** Every Guard id a Deferral or an Annotation in the Plan names. */
function actedGuardIds(plan: Plan): ReadonlySet<string> {
	const ids = new Set<string>();
	for (const task of plan.tasks) {
		for (const deferral of task.deferrals) {
			ids.add(deferral.guardId);
		}
		for (const annotation of task.annotations) {
			ids.add(annotation.guardId);
		}
	}
	return ids;
}

/**
 * One Rule, boxed so the boundary—not the bold name alone—is what separates
 * it from its neighbours, and headed by an empty, `aria-label`ed heading so a
 * screen-reader user gets a landmark per Rule rather than only one for the
 * whole page. `RuleSummary` renders no heading of its own (it is reused
 * inside a `<details>` on This Week, at a depth this route does not own), so
 * the landmark has to be supplied here instead of inside it.
 *
 * The heading carries no text of its own on purpose: its accessible name
 * comes from `aria-label`, so it names the Rule for a screen reader without
 * giving `rule.name` a second text node next to the one `RuleSummary` already
 * renders—which would turn every `getByText(rule.name)` query across this
 * route's specs into a "found multiple elements" failure.
 */
function RuleCard({ rule, inCurrentPlan }: { rule: Rule; inCurrentPlan: boolean }): ReactElement {
	return (
		<div className="rounded-lg border border-card-border bg-card p-4">
			{/* eslint-disable-next-line jsx-a11y/heading-has-content -- named via aria-label on purpose, see the docblock above */}
			<h3 aria-label={rule.name} className="sr-only" />
			<RuleSummary rule={rule} hideRegion inCurrentPlan={inCurrentPlan} />
		</div>
	);
}

function KindSection({
	title,
	rules,
	fired,
}: {
	title: string;
	rules: Rule[];
	fired: ReadonlySet<string>;
}): ReactElement | null {
	if (rules.length === 0) {
		return null;
	}

	return (
		<section aria-label={title}>
			<h2 className="mb-3 text-lg font-medium tracking-tight text-foreground">
				{title}
			</h2>
			<div className="space-y-4">
				{rules.map(rule => (
					<RuleCard key={rule.id} rule={rule} inCurrentPlan={fired.has(rule.id)} />
				))}
			</div>
		</section>
	);
}

/**
 * Lists every Rule the planner uses, grouped by kind—Window, Threshold,
 * Cadence, then Guards last under their own heading—so a reader can tell a
 * Rule's kind by which section it sits in rather than by inferring it from
 * whichever detail rows that kind happens to render. Guards keep their own
 * section: they never produce a Task, and grouping them apart lets a reader
 * scanning for work stop before reaching the block that creates none.
 *
 * The Region only ever names the one property this app plans for, so it
 * renders once here instead of once per Rule (`RuleSummary`'s own Region row
 * is suppressed via `hideRegion` for every card this component renders).
 *
 * No h1 anywhere below. The route owns the page's only h1; each section
 * heading here is an h2, and each Rule's own (visually hidden) heading is an
 * h3 nested under it.
 */
export function RuleList({ rules, plan }: RuleListProps): ReactElement {
	const fired = firedRuleIds(plan);
	const actedGuards = actedGuardIds(plan);
	const guards = rules.filter(rule => rule.kind === 'guard');
	const [firstRule] = rules;

	return (
		<div className="space-y-6">
			{firstRule !== undefined && (
				<p className="text-sm text-muted-foreground">
					{`${firstRule.region.name} · Zone ${firstRule.region.hardinessZone}`}
				</p>
			)}

			{KIND_ORDER.map(kind => (
				<KindSection
					key={kind}
					title={KIND_TITLES[kind]}
					rules={rules.filter(rule => rule.kind === kind)}
					fired={fired}
				/>
			))}

			{guards.length > 0 && (
				<section aria-label="Guards">
					<h2 className="mb-3 text-lg font-medium tracking-tight text-foreground">
						Guards
					</h2>
					<div className="space-y-4">
						{guards.map(rule => (
							<RuleCard key={rule.id} rule={rule} inCurrentPlan={actedGuards.has(rule.id)} />
						))}
					</div>
				</section>
			)}
		</div>
	);
}
