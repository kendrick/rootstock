import type { ChangeEvent, ReactElement } from 'react';
import type { DailyAggregate } from '@/planner/plan';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { Check, CirclePause, Info, Lock } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { CitationDisclosure } from '@/components/citation';
import { FOCUS_RING } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { citationLine, dayOfMonth, shortDate } from './citation-line';
import { LATE_GRACE_MS, NOT_SAVED, RECORD_DELAY_MS, TOO_LATE, UNDO_REFUSAL } from './permanence';
import { mechanicalRemainder, taskText } from './task-text';

/**
 * What a row needs from whoever owns the Store and the live region. Its own
 * interface so the held-back section can pass it through whole rather than
 * growing a prop per callback.
 */
export interface SignOffProps {
	/**
	 * Called once the wait ends, never at the tap. May return a promise; a
	 * rejection means the Store refused the write, and the row says so.
	 */
	onComplete?: (task: Task) => Promise<void> | void;
	/**
	 * Fired when a reader clicks a box that is already ticked. There is nothing
	 * to send, and that is the point: the caller owns the live region, so it is
	 * the only thing that can say so out loud. `late` is true when the tap came
	 * just after the wait ran out, which is a missed cancel rather than an
	 * attempt to undo old work, and deserves a different sentence.
	 */
	onUndoAttempt?: (task: Task, late: boolean) => void;
	/** The wait has started. The caller announces it. */
	onRecordStart?: (task: Task) => void;
	/** The reader cancelled inside the wait. Nothing was written. */
	onRecordCancel?: (task: Task) => void;
	/** Overrides `RECORD_DELAY_MS`. Specs shorten it; the page never does. */
	recordDelayMs?: number;
	/** Id of the permanence note over this row's group, so the warning is announced with the control. */
	describedBy?: string;
	/** The Store did not open, so there is nothing a sign-off could write to. */
	signOffDisabled?: boolean;
}

export interface TaskItemProps extends SignOffProps {
	/** The Task's line number on the ticket. Omitted where a Task renders outside a numbered run. */
	ordinal?: number;
	/** The row's fragment, from `ticketAnchor`, so the Yard can link to this line. */
	anchorId?: string;
	task: Task;
	/** Resolves the Task's own Rule and every Guard its Deferrals and Annotations name. */
	rulesById: ReadonlyMap<string, Rule>;
	plantsById: ReadonlyMap<string, Plant>;
	/** Narration's line for this Task. Null or omitted falls back to task.title. */
	narrationText?: string | null;
	/** `Plan.window`, passed through so a threshold Citation can show the readings it cites. */
	window?: DailyAggregate[];
	checked?: boolean;
	/** The ISO day the Occurrence that checks this Task carries. Printed under the evidence. */
	recordedOn?: string | null;
	/** Opens this Task's evidence on load. The caller picks which Task gets it. */
	citationOpen?: boolean;
}

/**
 * Where a sign-off is. `pending` is the wait, the one stretch where a reader
 * can still back out; `saving` is the write, which a tap can no longer stop.
 */
type Phase = 'idle' | 'pending' | 'saving';

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
		<p className="flex items-start gap-2 text-note text-muted">
			<Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
			<span className="min-w-0 max-w-prose">{children}</span>
		</p>
	);
}

/**
 * One Task as a ruled `<li>` in the Task table, with the sign-off box beside
 * the task text and the evidence in a drawer under both. The caller owns the
 * `<ul>`.
 *
 * The row's top rule is what identifies it as a Task, at the 3:1 WCAG 1.4.11
 * asks of a boundary that identifies a component. Nothing on the sheet sits on
 * a raised surface, and the Advisory block says in words that no Rule
 * produced it, so it can't be mistaken for cited work.
 *
 * The box fills the sign-off cell, so the hit target is the cell rather than a
 * 16px box. #50 measured that box at 27% of the 44pt minimum, for a control
 * used one-handed and outdoors. The row as a whole is not the target, because
 * the only irreversible act on the site must not fire from a tap meant to read
 * the instruction.
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
	ordinal,
	anchorId,
	rulesById,
	plantsById,
	narrationText = null,
	window,
	checked = false,
	recordedOn = null,
	citationOpen = false,
	onComplete,
	onUndoAttempt,
	onRecordStart,
	onRecordCancel,
	recordDelayMs = RECORD_DELAY_MS,
	describedBy,
	signOffDisabled = false,
}: TaskItemProps): ReactElement {
	// The box's accessible name is "Sign off" followed by the visible work, both
	// by reference, so no second copy of the sentence sits in the markup.
	const textId = useId();
	const verbId = useId();

	// Ephemeral, and deliberately not lifted. Whether this reader has tried to
	// untick this Task is a fact about one click on one screen, and the Store
	// has nothing to say about it.
	const [refused, setRefused] = useState<'no' | 'late' | 'old'>('no');
	const [failed, setFailed] = useState(false);
	const [phase, setPhase] = useState<Phase>('idle');
	const [secondsLeft, setSecondsLeft] = useState(0);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const committedAtRef = useRef<number | null>(null);

	function stopClock(): void {
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (tickRef.current !== null) {
			clearInterval(tickRef.current);
			tickRef.current = null;
		}
	}

	// A row that leaves mid-wait takes its timer with it. Nothing was written,
	// so leaving the page cancels the sign-off.
	useEffect(() => stopClock, []);

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

	function commit(): void {
		stopClock();
		committedAtRef.current = Date.now();
		setPhase('saving');

		// No rethrow. The line left on the row reports the failed write in a form
		// a reader can act on, and an unhandled rejection reaches nobody.
		void Promise.resolve(onComplete?.(task)).then(
			() => setPhase('idle'),
			() => {
				setPhase('idle');
				setFailed(true);
			},
		);
	}

	// A tap that lands while the write is in flight, or just after it, is a
	// cancel that missed the wait by a moment. Telling that reader "this stays
	// recorded" as if they were trying to erase last week's work answers a
	// question they did not ask.
	function isLateCancel(): boolean {
		return phase === 'saving'
			|| (committedAtRef.current !== null && Date.now() - committedAtRef.current < LATE_GRACE_MS);
	}

	function handleChange(event: ChangeEvent<HTMLInputElement>): void {
		// A second tap inside the wait is the cancel. Nothing has been sent, so
		// there is nothing to take back, only a timer to stop.
		if (phase === 'pending') {
			stopClock();
			setPhase('idle');
			onRecordCancel?.(task);
			return;
		}

		if (phase === 'idle' && event.target.checked && !checked) {
			setRefused('no');
			setFailed(false);
			setPhase('pending');
			setSecondsLeft(Math.ceil(recordDelayMs / 1000));
			onRecordStart?.(task);
			timerRef.current = setTimeout(commit, recordDelayMs);
			tickRef.current = setInterval(() => {
				setSecondsLeft(left => Math.max(left - 1, 1));
			}, 1000);
			return;
		}

		// An Occurrence is append-only, so unticking has nothing to send: undoing
		// one would mean deleting the record that says the work happened. The box
		// is controlled by `checked`, so React puts it straight back, and
		// `refused` is what keeps that snap-back from reading as a broken control.
		const late = isLateCancel();
		setRefused(late ? 'late' : 'old');
		onUndoAttempt?.(task, late);
	}

	const body = (
		<span className="flex min-w-0 flex-1 flex-col gap-1">
			{/*
			 * The Rule's name leads, and it did not before. The approved direction puts the
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
						'font-display text-title leading-[1.1] font-extrabold tracking-wide wrap-anywhere uppercase',
						checked && 'text-muted',
					)}
					>
						{rule?.name ?? task.ruleId}
					</span>

					{plantName !== null && (
						<span className="font-display font-semibold text-label tracking-widest text-muted uppercase">
							{plantName}
						</span>
					)}

					{/*
					 * On the row, not only inside the disclosure. The household can
					 * land on this page too, and a Task that is not theirs to do has
					 * to say so before anyone reaches its box. Ink, because red is
					 * kept for recorded work. It reads the `delegable` stamped at
					 * authoring time and derives nothing (AGENTS.md).
					 */}
					{!task.delegable && (
						<span className="border border-foreground px-1 font-display text-label font-extrabold tracking-widest text-foreground uppercase">
							Not delegable
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
			{/*
			 * Ink, where the record line below is red. The evidence says why the
			 * Rule fired, which is true before anything is done; red is kept for
			 * work that was recorded, so on an unsigned sheet nothing is red.
			 */}
			<span className="font-mono text-evidence tracking-tight text-foreground uppercase print:text-black">
				{citationLine(task.citation, rule)}
			</span>

			{/*
			 * Under the evidence rather than in place of it. The Citation says why the
			 * Rule fired and stays true after the work is done; this says when the
			 * work was recorded. Without it, a recorded row says the work is done
			 * and never says when.
			 */}
			{checked && recordedOn !== null && (
				<span className="font-mono text-evidence tracking-tight text-accent uppercase print:text-black">
					{`Recorded ${shortDate(recordedOn)}`}
				</span>
			)}
		</span>
	);

	const pending = phase !== 'idle';
	const held = task.status === 'deferred' && !checked;

	return (
		// Scroll margin so a followed link doesn't park the row under the top
		// edge, and an ink outline over a faint fill so the reader sees which line
		// the link meant.
		<li id={anchorId} className="scroll-mt-4 border-t border-rule first:border-t-0 target:bg-rule-faint/50 target:outline-2 target:-outline-offset-2 target:outline-foreground">
			{approaching
				? (
						<div className="grid min-h-11 grid-cols-[2.5rem_minmax(0,1fr)_6.5rem] sm:grid-cols-[3.25rem_minmax(0,1fr)_6.5rem] items-stretch text-body text-foreground">
							<span className="flex items-start justify-center border-r-2 border-rule px-2 py-3 font-display text-title leading-none font-extrabold text-muted">
								{ordinal === undefined ? '' : String(ordinal).padStart(2, '0')}
							</span>
							<span className="px-2 py-3 sm:px-3">{body}</span>
							{/*
							 * The sign-off column says why there is no box, in words rather
							 * than a blank or a glyph: colour and shape alone fail a reader who
							 * cannot see them, and a blank cell reads as a box that failed to
							 * render. The forecast day is when the threshold is expected to
							 * be crossed, which is when this row turns into work.
							 */}
							<span className="flex flex-col items-center justify-center gap-1 border-l-2 border-rule p-2 text-center font-display text-label font-extrabold tracking-widest text-muted uppercase">
								<span>Not yet</span>
								{task.citation.kind === 'threshold-projection' && (
									<span className="font-mono text-evidence tracking-tight">{`About ${dayOfMonth(task.citation.projectedDate)}`}</span>
								)}
							</span>
						</div>
					)
				: (
						// A div, not a `<label>`. A label makes the whole row the target, so
						// on a phone held one-handed a thumb resting on the instruction would
						// write a permanent record. The sign-off cell alone is about 100px
						// wide and as tall as the row, so it clears the 44px minimum #50
						// asked for without the text.
						<div className="grid min-h-11 grid-cols-[2.5rem_minmax(0,1fr)_6.5rem] sm:grid-cols-[3.25rem_minmax(0,1fr)_6.5rem] items-stretch text-body text-foreground">
							<span className="flex items-start justify-center border-r-2 border-rule px-2 py-3 font-display text-title leading-none font-extrabold">
								{ordinal === undefined ? '' : String(ordinal).padStart(2, '0')}
							</span>
							<span className="px-2 py-3 sm:px-3">{body}</span>

							{/*
							 * The sign-off box: the ticket's own gesture, and the only thing on the
							 * row that records. Unsigned it prompts; during the wait it fills from
							 * grey to stamp red and a second tap cancels; signed it carries the
							 * stamp. Red arrives whole only at the impact, so it still means one
							 * thing on this page: work that was recorded.
							 *
							 * The input fills the box rather than sitting inside it, so the whole
							 * cell is the target and the visible border is the control's own.
							 */}
							<span className="relative flex flex-col items-center justify-center gap-1.5 border-l-2 border-rule p-2">
								<span id={verbId} className="sr-only">{held ? 'Held back. Sign off anyway' : 'Sign off'}</span>
								<input
									type="checkbox"
									checked={checked || pending}
									disabled={signOffDisabled && !checked}
									onChange={handleChange}
									aria-labelledby={`${verbId} ${textId}`}
									aria-describedby={checked ? undefined : describedBy}
									className={cn('peer absolute inset-0 size-full cursor-pointer appearance-none disabled:cursor-not-allowed', FOCUS_RING)}
								/>
								{/*
								 * Ink, because a Guard holding work back is advice and stamp red is
								 * kept for recorded work. The box under it still works, because
								 * ADR 0002 makes a Deferral advice rather than a lock.
								 */}
								{held && (
									<span aria-hidden="true" className="pointer-events-none border-2 border-foreground px-1.5 py-0.5 font-display text-label font-extrabold tracking-widest text-foreground uppercase peer-checked:hidden">
										Held
									</span>
								)}
								{/*
								 * A drawn box, so the cell reads as the control it is. With only
								 * the words, it matches the column head above and reads as a label.
								 * The input still fills the whole cell; this is only the mark.
								 */}
								<span aria-hidden="true" className="pointer-events-none size-8 border-2 border-foreground peer-checked:hidden peer-disabled:border-muted" />
								<span aria-hidden="true" className="pointer-events-none font-display font-semibold text-label tracking-widest text-foreground uppercase peer-checked:hidden peer-disabled:text-muted peer-disabled:line-through">
									Sign off
								</span>
								{pending && !checked && (
									<span aria-hidden="true" className="pointer-events-none flex flex-col items-center gap-1.5 text-center">
										<span className="relative border-2 border-muted px-1.5 py-0.5 font-display text-label font-extrabold tracking-widest text-muted uppercase">
											Recording
											{/*
											 * The same stamp in red, revealed left to right over the wait.
											 * The fill is the time left, drawn where the finger already is.
											 */}
											<span
												className="record-fill absolute -inset-0.5 flex items-center justify-center border-2 border-accent bg-background text-accent"
												style={{ animationDuration: `${recordDelayMs}ms` }}
											>
												Recording
											</span>
										</span>
										{/*
										 * The seconds as a number, so the time left survives reduced
										 * motion, where the fill is switched off. "Cancel" rather than
										 * "tap again": the box is the control whether a thumb or a
										 * keyboard reaches it.
										 */}
										{phase === 'pending' && (
											<span className="font-display text-body leading-none font-extrabold tracking-wide whitespace-nowrap text-foreground uppercase tabular-nums">
												{`Cancel · ${secondsLeft}`}
											</span>
										)}
									</span>
								)}
								{checked && (
									<span className="stamp-mark pointer-events-none flex items-center gap-1 border-2 border-accent px-1.5 py-0.5 font-display text-label font-extrabold tracking-widest text-accent uppercase">
										<Check aria-hidden="true" className="size-3" />
										Recorded
									</span>
								)}
							</span>
						</div>
					)}

			{failed && (
				<p className="flex items-start gap-2 px-3 pb-2.5 text-note text-foreground">
					<span>{NOT_SAVED}</span>
				</p>
			)}

			{refused !== 'no' && (
				<p className="flex items-start gap-2 px-3 pb-2.5 text-note text-muted">
					<Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
					<span>{refused === 'late' ? TOO_LATE : UNDO_REFUSAL}</span>
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
