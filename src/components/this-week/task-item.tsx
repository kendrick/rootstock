import type { ChangeEvent, ReactElement } from 'react';
import type { DailyAggregate } from '@/planner/plan';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { CalendarClock, CirclePause, Info } from 'lucide-react';
import { useId } from 'react';
import { CitationDisclosure } from '@/components/citation';
import { cn } from '@/lib/utils';

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
	onComplete?: (task: Task) => void;
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
		<p className="flex items-start gap-2 text-sm text-muted-foreground">
			<Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
			<span className="min-w-0">{children}</span>
		</p>
	);
}

/**
 * One Task as a `<li>`, with the check-off box beside the evidence rather than
 * inside it. The caller owns the `<ul>`.
 *
 * No heading anywhere below. The route owns the page's only h1 and every
 * section heading under it is an h2, so a heading here would land at whatever
 * depth its section happened to sit at, and `tests/integration/smoke.spec.ts`
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
	onComplete,
}: TaskItemProps): ReactElement {
	// Names the visible task text so the check-off box can point at it. An
	// aria-label would satisfy an axe run too, and leave two copies of the same
	// sentence to keep in step.
	const textId = useId();

	const rule = rulesById.get(task.ruleId) ?? null;
	const plantName = task.plantId === null
		? null
		: (plantsById.get(task.plantId)?.name ?? task.plantId);

	// Contract 14. The Planner writes `title` for every Task whether or not the
	// model ever ran, so the fallback is the mechanical prose ADR 0001 calls a
	// real deliverable rather than a hole in the page. An empty narration string
	// counts as no narration, since rendering it would leave the Task with no
	// words on it at all.
	const text = narrationText !== null && narrationText.trim() !== '' ? narrationText : task.title;

	// Nothing has called for this work yet, so there is nothing to record having
	// done. `isCompleted` never returns true for an approaching Task, so a box
	// here would come back empty on the next render however often it was ticked.
	const approaching = task.status === 'approaching';

	function handleChange(event: ChangeEvent<HTMLInputElement>): void {
		// An Occurrence is append-only, so unticking has nothing to send. Undoing
		// one would mean deleting the record that says the work happened. The box
		// is controlled by `checked`, so React puts it back where the store says
		// it belongs.
		if (event.target.checked) {
			onComplete?.(task);
		}
	}

	const summary = (
		<span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
			<span id={textId} className="min-w-0">{text}</span>

			{/*
			 * A span rather than the Badge primitive, which renders a div.
			 * citation.tsx wraps everything passed as `summary` in a `<span>`, and
			 * a span takes phrasing content only.
			 */}
			{approaching && (
				<span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted-foreground">
					Approaching
				</span>
			)}

			{plantName !== null && (
				<span className="basis-full text-xs text-muted-foreground">{plantName}</span>
			)}
		</span>
	);

	return (
		<li className="flex items-start gap-3">
			{approaching
				? (
						// Holds the column the check-off box would have taken, so an
						// approaching Task lines up with the work above it. The missing box,
						// this glyph, and the word beside the task text are three cues for
						// one distinction, because colour alone fails a reader who cannot
						// see it. source-badge.tsx already made that case.
						<CalendarClock
							aria-hidden="true"
							className="mt-2.5 size-4 shrink-0 text-muted-foreground"
						/>
					)
				: (
						<input
							type="checkbox"
							checked={checked}
							onChange={handleChange}
							aria-labelledby={textId}
							className={cn(
								'mt-2.5 size-4 shrink-0 cursor-pointer accent-primary',
								'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
							)}
						/>
					)}

			<div className="min-w-0 flex-1 space-y-2">
				<CitationDisclosure
					summary={summary}
					citation={task.citation}
					rule={rule}
					delegable={task.delegable}
					window={window}
				/>

				{(task.deferrals.length > 0 || task.annotations.length > 0) && (
					<div className="space-y-1.5 px-3">
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
			</div>
		</li>
	);
}
