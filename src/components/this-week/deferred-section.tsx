import type { ReactElement } from 'react';
import type { DailyAggregate } from '@/planner/plan';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { PERMANENCE_NOTE } from './permanence';
import { TaskItem } from './task-item';

export interface DeferredSectionProps {
	/** Already filtered to status 'deferred'. */
	tasks: Task[];
	rulesById: ReadonlyMap<string, Rule>;
	plantsById: ReadonlyMap<string, Plant>;
	narrationById?: ReadonlyMap<string, string>;
	/** `Plan.window`, passed through so a threshold Citation can show the readings it cites. */
	window?: DailyAggregate[];
	completedIds?: ReadonlySet<string>;
	/** The one Task on the page whose evidence opens on load, when it is one of these. */
	openCitationId?: string | null;
	onComplete?: (task: Task) => void;
	onUndoAttempt?: (task: Task) => void;
}

/**
 * What a reader is told when nothing is held back.
 *
 * Household words, and no capital-G Guard: the reader this page is for does
 * not have the glossary. ADR 0002's machinery is the most distinctive thing
 * this app does, and it has never once had a live example on the deployed
 * site, because holding work back needs rain in the forecast. An empty week is
 * the only chance the section gets to explain itself, so it takes it.
 */
const NOTHING_HELD = 'Nothing is holding work back this week. Some rules do only that: not before '
	+ 'rain, not until evening, nothing on the fig until spring. When one applies, the task stays on '
	+ 'this page with the reason attached, rather than dropping off the list.';

/** And what it says when something is. */
const SOMETHING_HELD = 'A rule called for this work, and another is holding it. Each line names '
	+ 'which rule, and what would let the work go ahead.';

/**
 * The section ADR 0002 exists to make possible. A Guard cannot remove a Task,
 * so held-back work stays in the Plan and stays on screen here, each one
 * still carrying the Citation that produced it and the Deferral that held it
 * back. `TaskItem` already renders both, so this component composes it rather
 * than re-deriving a Guard name or a release string from the Task
 * itself—doing that by hand would give a deferred Task a different shape from
 * a fired one, with no citation behind the difference.
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
	window,
	completedIds,
	openCitationId = null,
	onComplete,
	onUndoAttempt,
}: DeferredSectionProps): ReactElement {
	return (
		<section aria-labelledby="deferred-heading" className="space-y-3">
			<div className="space-y-1">
				<h2 id="deferred-heading" className="text-base font-semibold text-foreground">
					Held back
				</h2>
				<p className="max-w-prose text-sm text-muted-foreground">
					{tasks.length > 0 ? SOMETHING_HELD : NOTHING_HELD}
				</p>

				{/*
				 * ADR 0002 makes a Deferral advice rather than a lock, so a held
				 * Task keeps its box: somebody who watered the fig anyway has a
				 * right to record it. That box writes the same permanent Occurrence
				 * every other box writes, so the warning `TaskGroup` carries over
				 * the ready work has to reach this list as well. Without it a
				 * reader could only be told by the live region, which says nothing
				 * to anyone looking at the screen.
				 */}
				{tasks.length > 0 && (
					<p className="max-w-prose text-sm text-muted-foreground">{PERMANENCE_NOTE}</p>
				)}
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
							window={window}
							checked={completedIds?.has(task.id) ?? false}
							citationOpen={task.id === openCitationId}
							onComplete={onComplete}
							onUndoAttempt={onUndoAttempt}
						/>
					))}
				</ul>
			)}
		</section>
	);
}
