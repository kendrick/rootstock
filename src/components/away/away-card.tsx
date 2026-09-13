'use client';

import type { ReactElement } from 'react';
import type { Narration } from '@/artifact/narration';
import type { Task } from '@/planner/task';
import { ArtifactGate } from '@/components/artifact-gate';
import { StalenessBanner } from '@/components/staleness-banner';
import { WithheldCount } from './withheld-count';

/**
 * Every Task in the Plan, sorted by who it belongs to. The card renders one
 * bucket and keeps the other three, because the count under the list is built
 * from two of them and someone who finishes the list still has to learn that
 * the week held more.
 */
export interface CardPartition {
	/** Fired and delegable. The only Tasks anyone but the owner ever sees. */
	shown: Task[];
	/** Fired, and the owner's to do—chemical work above all. */
	ownerOnly: Task[];
	/** Held back by a Guard, delegable or not: nobody does this work this week. */
	deferred: Task[];
	/** Approaching, so there is no work yet. Counted nowhere, for that reason. */
	approaching: Task[];
}

/**
 * What the card says when it has nothing to hand over.
 *
 * The two sentences exist because one of them is a lie in the other's case. An
 * empty list with work withheld behind it is an ordinary September: the only
 * Rule in season is chemical, so the household's list is empty and the yard
 * still needs something. Saying the yard needs nothing there is the exact
 * belief #15 was written against, since a household that reads a finished list
 * as a finished yard is how a pre-emergent window closes.
 */
function emptyText(withheld: number): string {
	return withheld === 0
		? 'Nothing in the yard needs doing this week.'
		: 'There is nothing here for you this week.';
}

/**
 * One pass over the Plan rather than a filter for the list and a second for the
 * count. Two filters can disagree, and the disagreement is silent: a Task in
 * neither is a Task that left the Plan without anyone deciding it should. The
 * spec asserts the four buckets are total and disjoint over the fixture Plan,
 * which is only checkable because the split happens once, here.
 *
 * Reads `status` and `delegable` and nothing else. CONTEXT.md's Delegable entry
 * puts the tag policy upstream of the stamped flag, and `isDelegable` is where
 * it already ran; a view that re-derived delegability from `tags` would be the
 * Planner's decision made a second time, with a second chance to get it wrong
 * the day someone writes a chemical Rule and forgets the tag.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the split belongs beside the one component that reads it; a second file is where a second copy of the rule starts
export function partitionForCard(tasks: Task[]): CardPartition {
	const partition: CardPartition = { shown: [], ownerOnly: [], deferred: [], approaching: [] };

	for (const task of tasks) {
		if (task.status === 'deferred') {
			partition.deferred.push(task);
		}
		else if (task.status === 'approaching') {
			partition.approaching.push(task);
		}
		else if (task.delegable) {
			partition.shown.push(task);
		}
		else {
			partition.ownerOnly.push(task);
		}
	}

	return partition;
}

/**
 * The sentence a reader gets for one Task. ADR 0001 makes `title` a real
 * deliverable: Narration selects, so a Task the model passed over is an
 * ordinary Task carrying mechanical prose, and the household cannot tell which
 * kind it is holding.
 */
function taskText(task: Task, narration: Narration | null): string {
	return narration?.tasks.find(entry => entry.taskId === task.id)?.text ?? task.title;
}

export interface AwayCardProps {
	artifact: unknown;
	status: unknown;
	/** Pins the instant the staleness banner measures against; see its own props docblock. Specs pass one, the route does not. */
	now?: Date;
}

/**
 * The read-only view of Delegable Tasks the rest of the household works from.
 *
 * What it must never say comes from ADR 0004 and CONTEXT.md's Away Card entry:
 * that anyone is travelling, or when. The card renders the same either way,
 * which is what makes a discovered link harmless, so the heading names the yard
 * and nothing below it renders a date.
 *
 * The count under the list is here because a household that works the card to
 * the bottom and reads a finished list as a finished yard is how a pre-emergent
 * window closes. The card says how much it is keeping back before anyone walks
 * away from it.
 *
 * Nothing here takes input. #15 rules out shared state, and a checkbox that
 * silently fails to sync is worse than a sheet of paper—which is what this card
 * becomes most weeks.
 *
 * A deferred Task arrives here as an anonymous number, which is narrower than
 * CONTEXT.md's Deferred Task entry describes. That entry and ADR 0002 both say
 * a deferred Task stays on screen carrying the Guard that held it and the
 * condition that would release it, and it does—on This Week, which the owner
 * reads. The release condition is a reason to act once it clears, and this
 * reader has no standing to act on it. Naming the Guard would also name the
 * work, which is the one thing the count is built to avoid.
 */
export function AwayCard({ artifact, status, now }: AwayCardProps): ReactElement {
	return (
		<ArtifactGate artifact={artifact} status={status}>
			{(validated) => {
				const { shown, ownerOnly, deferred } = partitionForCard(validated.artifact.plan.tasks);

				return (
					// print:text-black and its siblings below are here because the theme
					// is light text on a near-black page, and the Shell's own colours
					// are not this component's to change. A reader who prints the card
					// and carries it into the yard gets ink on white either way.
					<div className="space-y-6 print:space-y-4 print:text-black">
						<h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl print:text-black">
							Yard tasks this week
						</h1>

						{/* Above the first item, and louder than anywhere else on the
						    site. Every other route is read in front of the machine that
						    would show a fresher copy; this one is read in a yard, off
						    paper, by someone with no way to check. */}
						<StalenessBanner
							prominent
							generatedAt={validated.artifact.generatedAt}
							status={validated.status}
							now={now}
						/>

						{shown.length === 0
							? (
									<p className="text-base text-muted-foreground sm:text-lg print:text-black">
										{emptyText(ownerOnly.length + deferred.length)}
									</p>
								)
							: (
									<ul className="divide-y divide-border rounded-md border border-border print:border-black">
										{shown.map(task => (
											// break-inside-avoid so one task does not split across two
											// sheets, which is the one way a printed line gets missed.
											<li
												key={task.id}
												className="px-4 py-3 text-base sm:text-lg print:break-inside-avoid print:py-2 print:text-black"
											>
												{taskText(task, validated.artifact.narration)}
											</li>
										))}
									</ul>
								)}

						<WithheldCount ownerOnly={ownerOnly.length} deferred={deferred.length} />
					</div>
				);
			}}
		</ArtifactGate>
	);
}
