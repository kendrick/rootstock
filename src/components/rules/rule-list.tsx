import type { ReactElement } from 'react';
import type { Rule } from '@/rules/rule';
import { RuleSummary } from '@/components/rule-summary';

export interface RuleListProps {
	rules: Rule[];
}

/**
 * Lists every Rule the planner uses, with Guards grouped last under their own
 * section heading. Guards never produce Tasks—the badge on each one says so—but
 * grouping them separately means a reader scanning for work to do can stop at
 * the top and skip the Guard block entirely.
 *
 * No h1 anywhere below. The route owns the page's only h1; the h2 here belongs
 * to the Guards section alone.
 */
export function RuleList({ rules }: RuleListProps): ReactElement {
	const nonGuards = rules.filter(rule => rule.kind !== 'guard');
	const guards = rules.filter(rule => rule.kind === 'guard');

	return (
		<div className="space-y-6">
			<div className="space-y-4">
				{nonGuards.map(rule => (
					<RuleSummary key={rule.id} rule={rule} />
				))}
			</div>

			{guards.length > 0 && (
				<section aria-label="Guards">
					<h2 className="mb-3 text-lg font-medium tracking-tight text-foreground">
						Guards
					</h2>
					<div className="space-y-4">
						{guards.map(rule => (
							<RuleSummary key={rule.id} rule={rule} />
						))}
					</div>
				</section>
			)}
		</div>
	);
}
