'use client';

import type { ReactElement } from 'react';
import type { Artifact, StatusRecord } from '@/artifact/artifact';
import type { Occurrence } from '@/planner/occurrence';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import type { Store } from '@/store/store';
import type { Plant } from '@/yard/plant';
import { useEffect, useMemo, useState } from 'react';
import { staleness } from '@/artifact/staleness';
import { cn } from '@/lib/utils';
import { isCompleted } from '@/planner/completion';
import { seedPlants, seedRules, seedYard } from '@/seed';
import { listOccurrences, openBrowserStore } from '@/store/browser';
import { recordOccurrence } from '@/store/occurrence';
import { Advisories } from './advisories';
import { DeferredSection } from './deferred-section';
import { PERMANENCE_NOTE, recordedAnnouncement, UNDO_REFUSAL } from './permanence';
import { TaskGroup } from './task-group';
import { TaskItem } from './task-item';
import { taskText } from './task-text';
import { WeekSummary } from './week-summary';

export interface ThisWeekProps {
	artifact: Artifact;
	status: StatusRecord;
	rules?: Rule[];
	plants?: Plant[];
	/**
	 * Both shapes, because both callers are real. A spec hands a
	 * `createFakeStore(...)` straight in, and the default has to stay a function
	 * so that resolving it can wait for a browser: `output: 'export'` prerenders
	 * this route in Node, where opening IndexedDB at module scope would fail the
	 * build.
	 */
	store?: Store | (() => Promise<Store>);
	/**
	 * Pins the instant the Artifact's age is measured against, the same prop
	 * `staleness-banner.tsx` takes and for the same reasons. Omit it and the band
	 * comes off the clock on every render, so a tab left open past the seven-day
	 * line de-emphasizes itself without a reload.
	 */
	now?: Date;
}

/**
 * The instant an Occurrence recorded from this page carries.
 *
 * The day comes from the Plan rather than from the clock. The reader is acting
 * on the Plan in front of them, and a browser reading the clock an hour after
 * midnight would file the work under a day the Plan never planned for.
 *
 * Midday and not midnight, because `cadence-rule.ts` reads the instant back
 * through `localDate(completedAt, timeZone)` to count its interval. UTC
 * midnight resolves to the day before anywhere west of Greenwich, this yard
 * included, so a Cadence Rule would measure from a day the work did not happen
 * on. Midday survives that conversion at every offset a yard could sit at, and
 * that is as close as this component can get: the props carry a Plan and a rule
 * set, never the yard's time zone.
 */
function completionInstant(asOf: string): string {
	return `${asOf}T12:00:00Z`;
}

function byId<T extends { id: string }>(records: T[]): ReadonlyMap<string, T> {
	return new Map(records.map(record => [record.id, record]));
}

/**
 * The whole of what a reader sees on This Week: the work that fired, the work
 * a threshold is still climbing toward, the work a Guard is holding, and
 * whatever the model noticed that no Rule produced.
 *
 * Every mount reads the checked state back from the Store rather than holding a
 * flag beside the Task. An Occurrence is the record that work happened
 * (CONTEXT.md), so the Store already holds the answer, and a second copy in
 * component state is the one that goes stale the moment a reader opens the page
 * on a second device. The check-off round trip works the same way: a tick writes
 * an Occurrence and then re-reads the history, so a box that stays ticked is one
 * the Store agreed about.
 *
 * `rules` and `plants` are props with seed defaults rather than module reads.
 * The Artifact cites Rules by id, and what those ids resolve against is what a
 * test needs to vary. The case worth reaching is the one the shipped data is
 * already in, where a cited Rule is missing from the rule set entirely.
 */
export function ThisWeek({
	artifact,
	status,
	rules = seedRules,
	plants = seedPlants,
	store = openBrowserStore,
	now,
}: ThisWeekProps): ReactElement {
	const rulesById = useMemo(() => byId(rules), [rules]);
	const plantsById = useMemo(() => byId(plants), [plants]);

	// Keyed by task id and not by rule id: one Rule fires for several Plants, so
	// a rule id names a set of Tasks rather than one. `narration.ts` makes the
	// same argument for keying the model's own output that way.
	const narrationById = useMemo(
		() => new Map((artifact.narration?.tasks ?? []).map(entry => [entry.taskId, entry.text])),
		[artifact.narration],
	);

	// The opened Store sits beside the history so a tick writes through the same
	// handle the read came from. Resolving the prop again in the click handler
	// would open a second database for one write.
	const [opened, setOpened] = useState<Store | null>(null);
	const [occurrences, setOccurrences] = useState<Occurrence[]>([]);

	useEffect(() => {
		// `openBrowserStore` reaches for `globalThis.indexedDB`, and
		// `next.config.ts` sets `output: 'export'`, so every route is prerendered
		// in Node where that global does not exist. An effect is the earliest point
		// a browser is certain, so the prop resolves here and never at module scope
		// or during render.
		let live = true;

		async function load(): Promise<void> {
			const resolved = typeof store === 'function' ? await store() : store;
			const history = await listOccurrences(resolved);

			// A Store that answers after the reader has navigated away has nothing
			// to update, and setting state on the way out is how a second mount
			// against a different Store ends up showing the first one's history.
			if (!live) {
				return;
			}

			setOpened(resolved);
			setOccurrences(history);
		}

		// No catch, on purpose. A Store that will not open leaves every box
		// unticked, and swallowing the reason would make a broken Store look like a
		// yard where nothing has been done. The browser's unhandled-rejection
		// report is the only trace this component can leave.
		void load();

		return () => {
			live = false;
		};
	}, [store]);

	// The same gate `staleness-banner.tsx` puts in front of its own band, for the
	// same two reasons. `output: 'export'` prerenders this route in Node, so a
	// clock read during the first render would bake the build machine's instant
	// into the exported HTML and the browser would contradict it on hydration. And
	// a mount flag rather than the instant, because storing the instant would
	// freeze the band at whatever it was when the tab opened, and the tab left
	// open over a weekend is the case CONTEXT.md's Staleness entry exists for.
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		// eslint-disable-next-line react/set-state-in-effect -- the prerender has to run once with no clock at all, so the extra render is the point
		setMounted(true);
	}, []);

	// react/purity is right that reading the clock mid-render is impure, and the
	// impurity is the feature: age is a fact about the moment somebody is looking.
	// eslint-disable-next-line react/purity -- see above; every render past the first is meant to re-read the clock
	const asOf = now ?? (mounted ? new Date() : null);

	// #12 asks for the Task list to go quiet under the banner once the Artifact is
	// over a week old. `staleness()` owns both boundaries, so this reads the band
	// it returns and never re-derives one from `ageHours`.
	const expired = asOf !== null && staleness(artifact.generatedAt, asOf, status).band === 'expired';

	const tasks = artifact.plan.tasks;
	/*
	 * No Citation panel opens on its own.
	 *
	 * ADR 0001 calls the cited-Task property the architecturally interesting one,
	 * and #50 found it fully present in the DOM and entirely absent from the
	 * screen: three visible tasks, zero visible citations, a 16px chevron the only
	 * thing advertising them. Every Task answers that by rendering its Citation on
	 * a line of its own beneath the instruction, in the one colour this world
	 * reserves for cited work, so a Task cannot reach the screen without its
	 * evidence beside it.
	 *
	 * Opening a panel here would cost a screenful to prove what that line already
	 * proves. The disclosure holds the full apparatus and waits to be asked.
	 */
	const openCitationId: string | null = null;

	const completedIds = useMemo(
		() => new Set(
			tasks
				// The Rule is resolved here and handed down rather than looked up
				// inside `isCompleted`, per that function's own docblock: the same
				// resolution drives the "not in the current rule set" line, so one
				// lookup keeps completion and presentation from disagreeing.
				.filter(task => isCompleted(task, occurrences, artifact.plan.asOf, rulesById.get(task.ruleId) ?? null))
				.map(task => task.id),
		),
		[tasks, occurrences, artifact.plan.asOf, rulesById],
	);

	/*
	 * What the live region below is currently saying. Empty until a reader acts,
	 * because the region has to already exist in the document for a screen
	 * reader to announce what lands in it, and one rendered on demand is one
	 * nobody hears.
	 *
	 * Without this region a write is announced nowhere. The box changes, the
	 * Occurrence lands in IndexedDB, and a reader who is not watching that one
	 * box gets no confirmation the yard recorded anything at all.
	 */
	const [announcement, setAnnouncement] = useState('');

	function handleComplete(task: Task): void {
		// A tick that lands before the Store has answered goes nowhere. The box is
		// controlled by what the Store says, so React puts it straight back, and
		// nothing half-written is left behind to reconcile.
		if (opened === null) {
			return;
		}

		void (async () => {
			await recordOccurrence(opened, {
				ruleId: task.ruleId,
				plantId: task.plantId,
				completedAt: completionInstant(artifact.plan.asOf),
			});

			// Re-read rather than pushing the new Occurrence onto the list in hand.
			// The Store is the thing that has to agree for the box to survive a
			// reload, so the render after a tick comes from the same read the next
			// mount will do.
			setOccurrences(await listOccurrences(opened));

			// After the read, not before it. The sentence claims the yard holds the
			// record, and the only moment that claim is true is once the Store has
			// been asked again and said so.
			setAnnouncement(recordedAnnouncement(taskText(task.title, narrationById.get(task.id))));
		})();
	}

	function handleUndoAttempt(): void {
		setAnnouncement(UNDO_REFUSAL);
	}

	// `.map(taskItem)` hands the index through, which is where the ticket's line
	// numbers come from. They number the run a reader is looking at rather than
	// anything stored on the Task, so a filtered group counts from one.
	function taskItem(task: Task, index: number): ReactElement {
		return (
			<TaskItem
				key={task.id}
				task={task}
				ordinal={index + 1}
				rulesById={rulesById}
				plantsById={plantsById}
				narrationText={narrationById.get(task.id) ?? null}
				window={artifact.plan.window}
				checked={completedIds.has(task.id)}
				citationOpen={task.id === openCitationId}
				onComplete={handleComplete}
				onUndoAttempt={handleUndoAttempt}
			/>
		);
	}

	// This sentence reports the Plan and nothing else. Whether the runner that
	// built it is still working is a second question, and `StalenessBanner` above
	// answers that one in every band, so repeating it here would print the failed
	// run twice on one screen.
	const nothingDue = 'Nothing in the yard is due this week.';

	return (
		<div className="space-y-8">
			{/*
			 * #12's de-emphasized state. The loud banner belongs to the shell; the work
			 * underneath it goes quiet.
			 *
			 * Muted theme tokens carry that, never an `opacity` value.
			 * `text-muted` sits on this background all over the app and
			 * clears contrast, where an arbitrary opacity is a contrast claim nobody
			 * has checked, and `tests/integration/smoke.spec.ts` runs axe over this
			 * page in a sweep #16 is widening. The custom-property override is the half
			 * that reaches the children: they set `text-foreground` on their own
			 * headings and task text, so redefining the token those utilities resolve
			 * against mutes the whole subtree, and no component below has to learn what
			 * staleness is.
			 *
			 * None of it reaches the exported HTML, for the same reason the banner's
			 * band does not: `asOf` stays null until the mount flag flips.
			 */}
			<div className={cn('space-y-8', expired && 'text-muted [--foreground:var(--muted-foreground)]')}>
				{/*
				 * The model's own sentences about the week, which nothing rendered
				 * until #62: the field was required, generated and committed on
				 * every run, and read by no one. It sits inside the de-emphasis
				 * because it describes the Plan and ages with it, and below the
				 * route's authored purpose copy because the two answer different
				 * questions.
				 */}
				<WeekSummary summary={artifact.narration?.summary ?? null} />
			</div>

			{/*
			 * Outside the de-emphasis above and the one below, deliberately. An
			 * Advisory is not part of a Plan (CONTEXT.md), so it has no Plan staleness
			 * to inherit: rain that is unlikely this week is worth acting on whether or
			 * not the daily run has stopped. It sits here rather than under the work
			 * because a homeowner acts on weather before they act on a checklist.
			 */}
			<Advisories advisories={artifact.narration?.advisories ?? []} />

			<div className={cn('space-y-8', expired && 'text-muted [--foreground:var(--muted-foreground)]')}>

				<TaskGroup heading="Ready now" emptyText={nothingDue} description={PERMANENCE_NOTE}>
					{tasks.filter(task => task.status === 'fired').map(taskItem)}
				</TaskGroup>

				{/*
				 * No `emptyText`, so a Plan with nothing on the horizon renders no
				 * group at all. CONTEXT.md's Approaching Task entry keeps this work
				 * apart from fired work because a forecast can be revised, and a
				 * heading over an empty list would make the revision look like a
				 * Task that vanished.
				 */}
				<TaskGroup heading="Approaching">
					{tasks.filter(task => task.status === 'approaching').map(taskItem)}
				</TaskGroup>

				<DeferredSection
					tasks={tasks.filter(task => task.status === 'deferred')}
					rulesById={rulesById}
					plantsById={plantsById}
					narrationById={narrationById}
					window={artifact.plan.window}
					completedIds={completedIds}
					openCitationId={openCitationId}
					onComplete={handleComplete}
					onUndoAttempt={handleUndoAttempt}
				/>
			</div>

			{/*
			 * An Advisory is not part of a Plan—the Planner cannot author one—so
			 * this reads the Narration directly. An unnarrated Artifact has none,
			 * and `Advisories` renders nothing for an empty list.
			 */}

			{/*
			 * One region for the page rather than one per Task. Every announcement
			 * here is about the same append-only log, and a screen reader handed a
			 * region per row has several places to watch for one kind of news.
			 *
			 * No `role="status"`. `StalenessBanner` already owns that role on this
			 * route, and a second one would give the page two elements answering to
			 * the same name. `aria-live` alone carries the politeness without the
			 * role, and `aria-atomic` makes the sentence arrive whole.
			 */}
			{/*
			 * The stub, torn off and kept. It says how much of the week is still open
			 * without naming a single job, which is the one thing a reader wants from
			 * across the room and the thing a list of rows cannot give them.
			 */}
			<div className="pt-2 print:hidden">
				<div aria-hidden="true" className="perforation" />
				<p className="mt-3 flex flex-wrap justify-between gap-x-4 font-display text-label font-bold tracking-widest uppercase">
					<span>{`Stub — ${tasks.length - completedIds.size} of ${tasks.length} open`}</span>
					<span className="text-muted">{seedYard.region.name}</span>
				</p>
			</div>

			<div aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
		</div>
	);
}
