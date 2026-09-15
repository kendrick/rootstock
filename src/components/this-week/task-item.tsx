import type { ChangeEvent, ReactElement } from 'react';
import type { DailyAggregate } from '@/planner/plan';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { CalendarClock, Check, CirclePause, Info, Lock } from 'lucide-react';
import { useId, useState } from 'react';
import { CitationDisclosure } from '@/components/citation';
import { FOCUS_RING } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { citationLine } from './citation-line';
import { UNDO_REFUSAL } from './permanence';
import { mechanicalRemainder, taskText } from './task-text';

export interface TaskItemProps {
	task: Task;
	/** Resolves the Task's own Rule and every Guard its Deferrals and Annotations name. */
	rulesById: ReadonlyMap<string, Rule>;
	plantsById: ReadonlyMap<string, Plant>;
	/** Narration's line for this Task. Null or omitted falls back to task.title. */
	narrationText?: string | null;
	/** `Plan.window`, passed through so a threshold Citation can show the readings it cites. */
	window?: DailyAggregate[];
	checked?: boolean;
	/** Opens this Task's evidence on load. The caller picks which Task gets it. */
	citationOpen?: boolean;
	onComplete?: (task: Task) => void;
	/**
	 * Fired when a reader clicks a box that is already ticked. There is nothing
	 * to send, and that is the point: the caller owns the live region, so it is
	 * the only thing that can say so out loud.
	 */
	onUndoAttempt?: (task: Task) => void;
}

/**
 * The Guard's name when the rule set carries it, and the raw id when it does
 * not. citation.tsx makes the same call for a Task whose own Rule has gone.
 * The Artifact recorded that a Guard reached this Task, so dropping the line
 * because the rule set moved on produces the silence ADR 0002 argues against.
 */
function guardName(guardId: string, rulesById: ReadonlyMap<string, Rule>): string {
	return rulesById.get(guardId)?.name ?? guardId;
}

/**
 * One Guard's line under the Task. Held-back work and a note beside the work
 * render in the same muted tone, so the glyph and the opening words are what
 * tell a reader which of the two they are looking at.
 */
function GuardNote({
	icon: Icon,
	children,
}: {
	icon: typeof Info;
	children: ReactElement | ReactElement[];
}): ReactElement {
	return (
		<p className="flex items-start gap-2 text-detail text-muted">
			<Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
			<span className="min-w-0">{children}</span>
		</p>
	);
}

/**
 * One Task as a `<li>` on the raised surface, with the check-off box beside
 * the task text and the evidence in a drawer under both. The caller owns the
 * `<ul>`.
 *
 * The Task carries `bg-card` and the 4.12:1 `--card-border`; the Deferred and
 * Advisory sections carry neither. Raise those two sections instead and the
 * page argues against itself, which is measurable: with the Tasks flat, #50
 * found the LCP element on This Week to be an Advisory span, the one block on
 * the page carrying no Citation.
 *
 * The box sits inside a `<label>` holding the task text, so the hit target is
 * the whole row rather than a 16px box. #50 measured that box at 27% of the
 * 44pt minimum, for a control used one-handed and outdoors, against a 56px
 * disclosure row beside it. The task text cannot sit in a `<summary>` and in
 * this label at once: a label inside a summary fights the disclosure for the
 * same click.
 *
 * No heading anywhere below. The route owns the page's only h1 and every
 * section heading under it is an h2, so a heading here would land at whatever
 * depth its section happened to sit at, and `tests/integration/this-week.spec.ts`
 * runs axe over the rendered page.
 *
 * The Deferrals and Annotations render outside the disclosure rather than in
 * its `children` slot. What a Guard has to offer is the reason some work is
 * waiting and what would release it, and a reader scanning the deferred
 * section would find nothing but titles if that sat behind a `<details>`
 * nobody opened. ADR 0002 keeps held work on screen for exactly that reason.
 */
export function TaskItem({
	task,
	rulesById,
	plantsById,
	narrationText = null,
	window,
	checked = false,
	citationOpen = false,
	onComplete,
	onUndoAttempt,
}: TaskItemProps): ReactElement {
	// Names the visible task text so the check-off box can point at it. The
	// wrapping label is what makes the row clickable; this is what keeps the
	// box's accessible name down to the sentence itself, rather than the whole
	// row including the Plant name and the recorded badge.
	const textId = useId();

	// Ephemeral, and deliberately not lifted. Whether this reader has tried to
	// untick this Task is a fact about one click on one screen, and the Store
	// has nothing to say about it.
	const [refused, setRefused] = useState(false);

	const rule = rulesById.get(task.ruleId) ?? null;
	const plantName = task.plantId === null
		? null
		: (plantsById.get(task.plantId)?.name ?? task.plantId);

	// Shared with `ThisWeek`, which speaks the same sentence into the live region
	// after a write. `task-text.ts` carries the reason that has to be one
	// function rather than the same expression written out in two places.
	// With Narration on this is the model's sentence. With it off the row has
	// already said the Rule's name and the target above, so only the clause the
	// Planner added survives, and a Task with no clause renders no line at all.
	const ruleName = rule?.name ?? task.ruleId;
	const narrated = taskText(task.title, narrationText);
	const text = narrated === task.title
		? mechanicalRemainder(task.title, ruleName, plantName)
		: narrated;

	// Nothing has called for this work yet, so there is nothing to record having
	// done. `isCompleted` never returns true for an approaching Task, so a box
	// here would come back empty on the next render however often it was ticked.
	const approaching = task.status === 'approaching';

	function handleChange(event: ChangeEvent<HTMLInputElement>): void {
		if (event.target.checked) {
			setRefused(false);
			onComplete?.(task);
			return;
		}

		// An Occurrence is append-only, so unticking has nothing to send: undoing
		// one would mean deleting the record that says the work happened. The box
		// is controlled by `checked`, so React puts it straight back, and
		// `refused` is what keeps that snap-back from reading as a broken control.
		setRefused(true);
		onUndoAttempt?.(task);
	}

	const body = (
		<span className="flex min-w-0 flex-1 flex-col gap-1">
			{/*
			 * The job name leads, and it did not before. The approved direction puts the
			 * work first, what to do second, and the evidence third but never folded
			 * away. The rejected variation proved why that order matters: leading with
			 * evidence made the largest thing on the screen read "no occurrence", which
			 * is the absence of evidence, shouted.
			 *
			 * Falls back to the rule id rather than hiding. A Task whose Rule has left
			 * the rule set is exactly the case a reader needs to see, and a blank line
			 * would present it as ordinary work.
			 */}
			<span id={textId} className="flex flex-col gap-1">
				<span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<span className={cn(
						'font-display text-title leading-none font-bold tracking-wide uppercase',
						checked && 'text-muted',
					)}
					>
						{rule?.name ?? task.ruleId}
					</span>

					{plantName !== null && (
						<span className="font-display text-label tracking-widest text-muted uppercase">
							{plantName}
						</span>
					)}
				</span>

				{text !== null && (
					<span className={cn('min-w-0', checked && 'text-muted')}>
						{text}
					</span>
				)}
			</span>

			{/*
			 * The evidence, always rendered and never behind a control. The disclosure
			 * below still carries the full apparatus; this is the part that may not be
			 * folded away, because a product whose whole claim is that nothing was
			 * invented cannot put its proof behind a link the way the category does.
			 */}
			<span className="font-mono text-evidence tracking-tight text-accent uppercase print:text-black">
				{citationLine(task.citation)}
			</span>

			{/*
			 * Spans rather than the Badge primitive, which renders a div. These sit
			 * inside a `<label>` and beside phrasing content, so a block element
			 * here would be invalid markup the browser silently reflows.
			 */}

			{/*
			 * The done state has to read as done without the box. A ticked box is one
			 * cue, it is a colour cue, and it is the cue a reader scanning a phone in
			 * the sun is least likely to catch.
			 */}
			{checked && (
				<span className="inline-flex items-center gap-1 font-display text-label font-bold tracking-widest text-muted uppercase">
					<Check aria-hidden="true" className="size-3" />
					Recorded
				</span>
			)}
		</span>
	);

	return (
		<li className="border-t border-rule first:border-t-0">
			{approaching
				? (
						<div className="flex min-h-11 items-start gap-4 py-4 text-body text-foreground">
							{/*
							 * Holds the column the check-off box would have taken, so an
							 * approaching Task lines up with the work above it. The missing box,
							 * this glyph, and the word beside the task text are three cues for
							 * one distinction, because colour alone fails a reader who cannot
							 * see it. source-badge.tsx already made that case.
							 */}
							<CalendarClock
								aria-hidden="true"
								className="mt-0.5 size-5 shrink-0 text-muted"
							/>
							{body}
						</div>
					)
				: (
						// `min-h-11` is the 44px target the box alone never came close to,
						// and the label is what spends it: the row, the task text and the
						// Plant name all activate the box.
						<label className="flex min-h-11 cursor-pointer items-start gap-4 py-4 text-body text-foreground">
							{/*
							 * Drawn from the shell's own tokens rather than left to the UA.
							 * The page declares no `color-scheme`, so a native box painted
							 * itself solid white on the card and read as already ticked,
							 * and `accent-color` could not fix it: Chrome derives the
							 * unchecked box from the accent, so a near-white accent gives a
							 * near-white empty box. Dropping the accent hands the checked
							 * state to the UA's blue, which would be a second hue on a page
							 * that has exactly one.
							 *
							 * Still a real `<input type="checkbox">` under the paint, so
							 * the label, the keyboard and the accessibility tree are all
							 * the browser's.
							 */}
							<span className="relative mt-0.5 flex size-11 shrink-0 items-center justify-center">
								<input
									type="checkbox"
									checked={checked}
									onChange={handleChange}
									aria-labelledby={textId}
									className={cn(
										'record-control peer size-9 cursor-pointer appearance-none border-2 border-rule',
										'bg-background checked:border-accent checked:bg-accent',
										FOCUS_RING,
									)}
								/>
								<Check
									aria-hidden="true"
									className="pointer-events-none absolute size-6 text-accent-foreground opacity-0 peer-checked:opacity-100"
								/>
							</span>
							{body}
						</label>
					)}

			{refused && (
				<p className="flex items-start gap-2 px-3 pb-2.5 text-detail text-muted">
					<Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
					<span>{UNDO_REFUSAL}</span>
				</p>
			)}

			{(task.deferrals.length > 0 || task.annotations.length > 0) && (
				<div className="space-y-1.5 px-3 pb-2.5">
					{task.deferrals.map(deferral => (
						<GuardNote key={`${deferral.guardId}:${deferral.releaseWhen}`} icon={CirclePause}>
							<span>
								Held back by
								{' '}
								<span className="font-medium text-foreground">
									{guardName(deferral.guardId, rulesById)}
								</span>
							</span>
							{/*
							 * Contract 10 hands `releaseWhen` to the interface as the Guard's
							 * own `release` string. A label and then the string, rather than
							 * a sentence written here around it, so what a reader acts on is
							 * what the Guard said.
							 */}
							<span className="block">
								Releases when:
								{' '}
								<span className="text-foreground">{deferral.releaseWhen}</span>
							</span>
						</GuardNote>
					))}

					{task.annotations.map(annotation => (
						<GuardNote key={`${annotation.guardId}:${annotation.text}`} icon={Info}>
							<span>
								<span className="font-medium text-foreground">
									{guardName(annotation.guardId, rulesById)}
								</span>
								{': '}
								<span className="text-foreground">{annotation.text}</span>
							</span>
						</GuardNote>
					))}
				</div>
			)}

			<CitationDisclosure
				citation={task.citation}
				rule={rule}
				delegable={task.delegable}
				defaultOpen={citationOpen}
				window={window}
			/>
		</li>
	);
}
