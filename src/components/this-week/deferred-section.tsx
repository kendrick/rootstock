import type { ReactElement } from 'react';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { TaskItem } from './task-item';

export interface DeferredSectionProps {
	/** Already filtered to status 'deferred'. */
	tasks: Task[];
	rulesById: ReadonlyMap<string, Rule>;
	plantsById: ReadonlyMap<string, Plant>;
	narrationById?: ReadonlyMap<string, string>;
	completedIds?: ReadonlySet<string>;
	onComplete?: (task: Task) => void;
}

/**
 * The section ADR 0002 exists to make possible. A Guard cannot remove a Task,
 * so held-back work stays in the Plan and stays on screen here, each one
 * still carrying the Citation that produced it and the Deferral that held it
 * back. `TaskItem` already renders both, so this component composes it rather
 * than re-deriving a Guard name or a release string from the Task itself—
 * doing that by hand would give a deferred Task a different shape from a
 * fired one, with no citation behind the difference.
 *
 * Unlike `Advisories`, an empty list does not return null. ADR 0002's whole
 * argument is that silence has two causes a reader cannot tell apart from
 * outside—a Guard fired, or nobody wrote a Rule for this—and a section
 * that vanishes when there is nothing to hold back reproduces exactly that
 * ambiguity. Saying plainly that nothing is held is what a missing section
 * cannot do.
 */
export function DeferredSection({
	tasks,
	rulesById,
	plantsById,
	narrationById,
	completedIds,
	onComplete,
}: DeferredSectionProps): ReactElement {
	return (
		<section
			aria-labelledby="deferred-heading"
			className="space-y-3 rounded-md border border-border bg-muted/40 p-4"
		>
			<div className="space-y-1">
				<h2 id="deferred-heading" className="text-base font-semibold text-foreground">
					Held back
				</h2>
				<p className="text-sm text-muted-foreground">
					{tasks.length > 0
						? 'A Guard is holding this work back for now. Each line below names the Guard and what releases it.'
						: 'Nothing is being held back this week—no Guard has deferred any work.'}
				</p>
			</div>

			{tasks.length > 0 && (
				<ul className="space-y-3">
					{tasks.map(task => (
						<TaskItem
							key={task.id}
							task={task}
							rulesById={rulesById}
							plantsById={plantsById}
							narrationText={narrationById?.get(task.id) ?? null}
							checked={completedIds?.has(task.id) ?? false}
							onComplete={onComplete}
						/>
					))}
				</ul>
			)}
		</section>
	);
}
