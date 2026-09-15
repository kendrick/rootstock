import type { ReactElement } from 'react';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';

export interface NotLitProps {
	rules: Rule[];
	tasks: Task[];
}

/**
 * The Rules the yard holds that no evidence lit this week.
 *
 * This is the one piece of the page that argues ADR 0001 without saying
 * anything. The rule set is fixed and always present; the Planner invents
 * nothing and removes nothing; evidence is the only thing that decides which
 * Rules speak on a given date. Listing the silent ones makes that visible, and
 * answers the question a reader actually has standing in the yard—why is it not
 * telling me to overseed—without them having to go and look.
 *
 * Guards are excluded because a Guard creates no work (CONTEXT.md). A Guard
 * that did not fire has nothing to be silent about, and listing one here would
 * suggest the yard was owed work it was never going to be owed.
 *
 * Names only, and no conditions. The condition a Rule is waiting for belongs to
 * /rules, which exists and shows it; repeating it here would put a second
 * authority on the page and quietly turn a quiet footer into a second plan.
 */
export function NotLit({ rules, tasks }: NotLitProps): ReactElement | null {
	const lit = new Set(tasks.map(task => task.ruleId));
	const silent = rules.filter(rule => rule.kind !== 'guard' && !lit.has(rule.id));

	// A week that lit everything says so by having nothing here. An empty heading
	// over an empty list would read as a rendering failure.
	if (silent.length === 0) {
		return null;
	}

	return (
		<section aria-labelledby="not-lit-heading" className="border-t border-rule pt-4">
			<h2
				id="not-lit-heading"
				className="font-display text-label font-bold tracking-widest text-muted uppercase"
			>
				Not this week
			</h2>

			{/*
			 * A list, not a sentence. These are discrete Rules and a screen reader
			 * should be able to count them and move through them one at a time; a
			 * comma-joined string would arrive as one long run of words. The
			 * separators are drawn by CSS so they stay out of the accessible name.
			 */}
			<ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
				{silent.map(rule => (
					<li
						key={rule.id}
						className="font-display text-label tracking-wide text-muted uppercase before:mr-3 before:content-['·'] first:before:content-none"
					>
						{rule.name}
					</li>
				))}
			</ul>
		</section>
	);
}
