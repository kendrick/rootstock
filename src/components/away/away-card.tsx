'use client';

import type { ReactElement } from 'react';
import type { Narration } from '@/artifact/narration';
import type { Occurrence } from '@/planner/occurrence';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import { useMemo } from 'react';
import { ArtifactGate } from '@/components/artifact-gate';
import { StalenessBanner } from '@/components/staleness-banner';
import { recordedDates } from '@/components/this-week/recorded';
import { FOCUS_RING } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { seedOccurrences, seedRules } from '@/seed';
import { byWhen, shortDay, ticketNumber } from './stub-dates';
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
	/** Not delegable, fired or held back: the owner's either way, chemical work above all. */
	ownerOnly: Task[];
	/** Delegable, but held back by a Guard: nobody does this work this week. */
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
		? 'The yard doesn\'t need anything this week. Thanks for looking.'
		: 'Nothing on this card for you this week. Thanks for looking.';
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
 *
 * Delegability outranks deferral for the bucket. Undelegable work is the
 * owner's whether a Guard held it back or not, and counting it in `deferred`
 * would tell the household it'll come to them once the weather turns. The
 * Deferral still stops the owner, so the card reads `status` off `ownerOnly`
 * again when it words the count.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the split belongs beside the one component that reads it; a second file is where a second copy of the rule starts
export function partitionForCard(tasks: Task[]): CardPartition {
	const partition: CardPartition = { shown: [], ownerOnly: [], deferred: [], approaching: [] };

	for (const task of tasks) {
		if (task.status === 'approaching') {
			partition.approaching.push(task);
		}
		else if (!task.delegable) {
			partition.ownerOnly.push(task);
		}
		else if (task.status === 'deferred') {
			partition.deferred.push(task);
		}
		else {
			partition.shown.push(task);
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

/**
 * Spelled out, year included, for a reader holding paper on a fridge rather
 * than a device with its own clock in the corner. `en-US` is pinned for the
 * same reason StalenessBanner pins it: every other string on this card is
 * English by hand.
 */
const MADE_ON = new Intl.DateTimeFormat('en-US', {
	weekday: 'long',
	month: 'long',
	day: 'numeric',
	year: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
});

/**
 * One template for the column heads and every row, so a head can never sit
 * over the wrong column. Below `sm` on screen the INITIALS / DATE cell drops
 * out: nobody writes on a phone, and 390px can't spare it. Print always keeps
 * it, because the returned sheet is where it earns its place.
 */
const ROW_GRID = 'grid grid-cols-[2.5rem_minmax(0,1fr)_3.5rem] sm:grid-cols-[3.25rem_minmax(0,1fr)_4rem_8.5rem] print:grid-cols-[3.25rem_minmax(0,1fr)_4rem_8.5rem]';
const WRITE_IN_CELL = 'hidden border-l-2 border-rule sm:block print:block print:border-black';

export interface AwayCardProps {
	artifact: unknown;
	status: unknown;
	/** Pins the instant the staleness banner measures against; see its own props docblock. Specs pass one, the route does not. */
	now?: Date;
	/**
	 * The committed history, never a browser's. The card is shared, and one
	 * device's ticks aren't the owner's record (ADR 0006). Specs pass a fixture.
	 */
	occurrences?: readonly Occurrence[];
	/** Resolves a Task's Rule for its window and for `isCompleted`. Specs may pass their own. */
	rules?: readonly Rule[];
}

/**
 * The read-only view of Delegable Tasks the rest of the household works from.
 *
 * What it must never say comes from ADR 0004 and CONTEXT.md's Away Card entry:
 * that anyone is travelling, or when. The card renders the same either way,
 * which is what makes a discovered link harmless, so the heading names the
 * yard rather than the reason anyone is reading it. Its dates are the Plan's
 * and the work's own: when the Plan was made, the week it covers, and when
 * each row stops mattering. None of them says who is home; #63 is the record
 * of the mistaken belief that any date at all would be a trip date.
 *
 * The count under the list is here because a household that works the card to
 * the bottom and reads a finished list as a finished yard is how a pre-emergent
 * window closes. The card says how much it is keeping back before anyone walks
 * away from it.
 *
 * Nothing here takes input toward the Plan. #15 rules out shared state, and a
 * checkbox that silently fails to sync is worse than a sheet of paper—which is
 * what this card becomes most weeks, complete with a box and a write-in cell
 * beside each line for a pen. The one button on the page opens the print
 * dialog and reads nothing back from it.
 *
 * A deferred Task arrives here as an anonymous number, which is narrower than
 * CONTEXT.md's Deferred Task entry describes. That entry and ADR 0002 both say
 * a deferred Task stays on screen carrying the Guard that held it and the
 * condition that would release it, and it does—on This Week, which the owner
 * reads. The release condition is a reason to act once it clears, and this
 * reader has no standing to act on it. Naming the Guard would also name the
 * work, which is the one thing the count is built to avoid.
 */
export function AwayCard({ artifact, status, now, occurrences = seedOccurrences, rules = seedRules }: AwayCardProps): ReactElement {
	const rulesById = useMemo(() => new Map(rules.map(rule => [rule.id, rule])), [rules]);

	return (
		<ArtifactGate artifact={artifact} status={status} audience="household">
			{(validated) => {
				const { plan, narration, generatedAt } = validated.artifact;
				const { shown, ownerOnly, deferred } = partitionForCard(plan.tasks);
				// The Rule keeps firing until its window closes, recorded or not, so
				// without this a recorded feeding prints as open and the lawn gets
				// a second one. Printed as recorded rather than dropped: a missing
				// row reads as work nobody called for, and "already recorded,
				// don't redo it" is the line this reader actually needs.
				const recorded = recordedDates(shown, occurrences, plan.asOf, rulesById);

				return (
					// The Away Card is the stub: the copy torn off a work-order ticket and
					// handed to whoever does the job, on the copy sheet rather than the top
					// one. `copy-sheet` redefines the ground for this subtree only; the
					// print: classes pin ink in case that override is ever scoped tighter.
					<div className="copy-sheet border-2 border-rule bg-background text-foreground print:border-black print:text-black">
						<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b-2 border-rule px-5 py-4 print:border-black">
							<div className="space-y-2">
								<p className="font-mono text-evidence tracking-widest print:text-black">
									{`${ticketNumber(plan.asOf)} · Stub`}
								</p>
								<h1 className="font-display text-display leading-none font-extrabold tracking-tight text-foreground uppercase print:text-black">
									{`Yard tasks, week of ${shortDay(plan.asOf)}`}
								</h1>
							</div>
							{/* The one control a read-only card gets to carry: it opens the
							    browser's own print dialog and touches nothing else, and it
							    leaves no trace on the sheet it produces. */}
							<button
								type="button"
								onClick={() => window.print()}
								className={cn(
									'min-h-11 border-2 border-rule px-4 font-display text-label font-extrabold tracking-widest uppercase print:hidden',
									FOCUS_RING,
								)}
							>
								Print
							</button>
						</div>

						{/* #63: a printed sheet with no date is indistinguishable from one
						    three weeks old. Unconditional, unlike StalenessBanner, which
						    goes silent on a fresh Artifact. */}
						<div className="space-y-5 px-5 py-4 print:space-y-4">
							<p className="font-mono text-evidence text-muted print:text-black">
								{'This card was made '}
								<time dateTime={generatedAt}>{MADE_ON.format(Date.parse(generatedAt))}</time>
								.
							</p>

							{/* Above the first item, and louder than anywhere else on the
							    site. Every other route is read in front of the machine that
							    would show a fresher copy; this one is read in a yard, off
							    paper, by someone with no way to check. */}
							<StalenessBanner
								prominent
								generatedAt={generatedAt}
								status={validated.status}
								now={now}
							/>

							{shown.length === 0
								? (
										<p className="max-w-prose text-body text-foreground print:text-black">
											{emptyText(ownerOnly.length + deferred.length)}
										</p>
									)
								: (
										<div className="border-2 border-rule print:border-black">
											{/* A printed form's convention, not a table for a screen
											    reader: each row already carries its own parts. */}
											<div aria-hidden="true" className={cn(ROW_GRID, 'border-b-2 border-rule font-display text-label font-extrabold tracking-widest uppercase print:border-black')}>
												<span className="px-2 py-1.5 text-center">No.</span>
												<span className="border-l-2 border-rule px-3 py-1.5 print:border-black">Task</span>
												<span className="border-l-2 border-rule px-1 py-1.5 text-center print:border-black">Sign off</span>
												<span className={cn(WRITE_IN_CELL, 'px-2 py-1.5')}>Initials / date</span>
											</div>
											{/* Safari drops list semantics once list-style is none,
											    which Tailwind's preflight sets, so the role isn't
											    redundant here whatever the lint rule assumes. */}
											{/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- see above */}
											<ul role="list">
												{shown.map((task, index) => {
													const recordedOn = recorded.get(task.id);

													return (
														// break-inside-avoid so one task doesn't split across two
														// sheets, which is the one way a printed line gets missed.
														<li
															key={task.id}
															className={cn(ROW_GRID, 'items-stretch border-t-2 border-rule first:border-t-0 print:break-inside-avoid print:border-black')}
														>
															<span className="px-2 py-3 text-center font-display text-title leading-none font-extrabold">
																{String(index + 1).padStart(2, '0')}
															</span>
															<div className="space-y-1 border-l-2 border-rule px-3 py-3 print:border-black">
																<p className="text-body">{taskText(task, narration)}</p>
																<p className="font-mono text-evidence print:text-black">
																	{recordedOn === undefined
																		? byWhen(task, rulesById.get(task.ruleId) ?? null, plan.asOf)
																		: `Already recorded ${shortDay(recordedOn)}`}
																</p>
															</div>
															<span className="flex items-start justify-center border-l-2 border-rule px-1 py-3 print:border-black">
																{/* A pen marks this, never a click: CONTEXT.md's
																    Occurrence entry makes the record the owner's alone.
																    border-current so the box matches the text beside it,
																    on screen and on paper. */}
																<span data-testid="pen-box" aria-hidden="true" className="size-6 shrink-0 border-2 border-current">
																	{recordedOn !== undefined && (
																		<svg viewBox="0 0 20 20" className="size-full" fill="none" stroke="currentColor" strokeWidth="2.5">
																			<path d="M4 4 16 16M16 4 4 16" />
																		</svg>
																	)}
																</span>
															</span>
															<span aria-hidden="true" className={cn(WRITE_IN_CELL, 'min-h-14')} />
														</li>
													);
												})}
											</ul>
										</div>
									)}
						</div>

						<WithheldCount
							ownerOnly={ownerOnly.length}
							ownerWaiting={ownerOnly.filter(task => task.status === 'deferred').length}
							deferred={deferred.length}
						/>
					</div>
				);
			}}
		</ArtifactGate>
	);
}
