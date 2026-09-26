import type { ReactElement } from 'react';
import type { SignOffProps } from './task-item';
import type { DailyAggregate } from '@/planner/plan';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { useId } from 'react';
import { permanenceNote } from './permanence';
import { Section } from './section';
import { TaskTable } from './task-group';
import { TaskItem } from './task-item';
import { ticketAnchor } from './ticket-anchor';

export interface DeferredSectionProps extends SignOffProps {
	/** Already filtered to status 'deferred'. */
	tasks: Task[];
	rulesById: ReadonlyMap<string, Rule>;
	plantsById: ReadonlyMap<string, Plant>;
	narrationById?: ReadonlyMap<string, string>;
	/** `Plan.window`, passed through so a threshold Citation can show the readings it cites. */
	window?: DailyAggregate[];
	completedIds?: ReadonlySet<string>;
	/** Task id to the ISO day its record carries. */
	recordedOn?: ReadonlyMap<string, string>;
	/** The permanence note, dated by the caller, which holds the Plan. */
	note?: string;
	/** The one Task on the page whose evidence opens on load, when it is one of these. */
	openCitationId?: string | null;
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
function nothingHeld(rulesById: ReadonlyMap<string, Rule>): string {
	const holders = [...rulesById.values()]
		.filter(rule => rule.kind === 'guard' && rule.effect === 'defer')
		.map(rule => rule.name);

	if (holders.length === 0) {
		return 'Nothing is holding work back this week.';
	}

	const count = holders.length === 1 ? 'One rule can' : `${holders.length} rules can`;
	const when = holders.length === 1 ? 'When it applies' : 'When one applies';
	return `Nothing is holding work back this week. ${count}: ${holders.join(', ')}. ${when}, the task stays on this page with the reason attached, rather than dropping off the list.`;
}

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
	recordedOn,
	note = permanenceNote(null),
	openCitationId = null,
	...signOff
}: DeferredSectionProps): ReactElement {
	// This list carries its own permanence note, so its rows point at it rather
	// than at the one over the ready work, which may not be on the page.
	const noteId = useId();
	const headingId = useId();

	return (
		<Section id={headingId} label="Held back">
			<p className="max-w-prose text-body text-muted">
				{tasks.length > 0 ? SOMETHING_HELD : nothingHeld(rulesById)}
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
				<p id={noteId} className="max-w-prose text-note text-muted">{note}</p>
			)}

			{tasks.length > 0 && (
				<TaskTable>
					{tasks.map((task, index) => (
						<TaskItem
							key={task.id}
							task={task}
							ordinal={index + 1}
							anchorId={ticketAnchor('Held back', index + 1)}
							rulesById={rulesById}
							plantsById={plantsById}
							narrationText={narrationById?.get(task.id) ?? null}
							window={window}
							checked={completedIds?.has(task.id) ?? false}
							recordedOn={recordedOn?.get(task.id) ?? null}
							citationOpen={task.id === openCitationId}
							{...signOff}
							describedBy={noteId}
						/>
					))}
				</TaskTable>
			)}
		</Section>
	);
}
