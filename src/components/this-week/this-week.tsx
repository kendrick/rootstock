'use client';

import type { ReactElement } from 'react';
import type { Artifact, StatusRecord } from '@/artifact/artifact';
import type { Occurrence } from '@/planner/occurrence';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import type { Store } from '@/store/store';
import type { Plant } from '@/yard/plant';
import { useEffect, useMemo, useState } from 'react';
import { isCompleted } from '@/planner/completion';
import { seedPlants, seedRules } from '@/seed';
import { listOccurrences, openBrowserStore } from '@/store/browser';
import { recordOccurrence } from '@/store/occurrence';
import { Advisories } from './advisories';
import { DeferredSection } from './deferred-section';
import { TaskGroup } from './task-group';
import { TaskItem } from './task-item';

export interface ThisWeekProps {
	artifact: Artifact;
	status: StatusRecord;
	rules?: Rule[]; // defaults seedRules
	plants?: Plant[]; // defaults seedPlants
	/** A Store, or a factory for one. Defaults to openBrowserStore. */
	store?: Store | (() => Promise<Store>);
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

	const tasks = artifact.plan.tasks;

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
		})();
	}

	function taskItem(task: Task): ReactElement {
		return (
			<TaskItem
				key={task.id}
				task={task}
				rulesById={rulesById}
				plantsById={plantsById}
				narrationText={narrationById.get(task.id) ?? null}
				checked={completedIds.has(task.id)}
				onComplete={handleComplete}
			/>
		);
	}

	// An empty list has two causes a reader cannot tell apart from the outside:
	// the yard has nothing due, or the run that would have found something never
	// finished. The banner above reports the broken runner; this line says what a
	// broken runner means for the emptiness under it, because "nothing to do"
	// otherwise reads as an answer.
	const nothingDue = status.ok
		? 'Nothing in the yard is due this week.'
		: 'Nothing is due this week—though the last run failed, so this may not be the current answer.';

	return (
		<div className="space-y-8">
			<TaskGroup heading="Ready now" emptyText={nothingDue}>
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
				completedIds={completedIds}
				onComplete={handleComplete}
			/>

			{/*
			 * An Advisory is not part of a Plan—the Planner cannot author one—so
			 * this reads the Narration directly. An unnarrated Artifact has none,
			 * and `Advisories` renders nothing for an empty list.
			 */}
			<Advisories advisories={artifact.narration?.advisories ?? []} />
		</div>
	);
}
