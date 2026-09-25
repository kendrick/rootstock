import type { ReactElement } from 'react';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { taskId } from '@/planner/task';
import { combinedNarratedArtifact, plantsById, rulesById, rulesByIdMissingDeepWaterFig } from './fixtures';
import { NOT_SAVED, RECORD_DELAY_MS, UNDO_REFUSAL } from './permanence';
import { TaskItem } from './task-item';

/**
 * The Tasks come out of the fixture Artifact rather than being retyped, so a
 * Task shape that changes upstream fails here by name instead of quietly
 * rendering against a stale copy of itself.
 */
function fixtureTask(id: string): Task {
	const task = combinedNarratedArtifact.plan.tasks.find(candidate => candidate.id === id);
	if (task === undefined) {
		throw new Error(`the this-week fixture Artifact no longer carries a Task with id '${id}'`);
	}
	return task;
}

const firedTask = fixtureTask('fall-pre-emergent@front-lawn');
const deferredTask = fixtureTask('deep-water-fig@fig-1');
const approachingTask = fixtureTask('spring-pre-emergent@front-lawn');

/** Narration's line for the fired Task, read off the fixture for the same reason the Tasks are. */
const firedNarration = combinedNarratedArtifact.narration?.tasks
	.find(entry => entry.taskId === firedTask.id)
	?.text;
if (firedNarration === undefined) {
	throw new Error(`the this-week fixture no longer narrates '${firedTask.id}': the narration-over-title case has nothing to prove`);
}

/**
 * `TaskItem` renders an `<li>` and the caller owns the `<ul>`, so every render
 * here supplies one. An `<li>` loose in a `<div>` parses in jsdom and would
 * never fail a test, which is how a component ships markup axe rejects on the
 * real page.
 */
function renderItem(item: ReactElement) {
	return render(<ul>{item}</ul>);
}

describe('taskItem', () => {
	it('renders the narration line when narration carries one', () => {
		renderItem(
			<TaskItem
				task={firedTask}
				rulesById={rulesById}
				plantsById={plantsById}
				narrationText={firedNarration}
			/>,
		);

		expect(screen.getByText(firedNarration)).toBeDefined();
		expect(screen.queryByText(firedTask.title)).toBeNull();
	});

	// Contract 14 and ADR 0001: the Planner writes `title` for every Task
	// whether or not the model ran, so this is the mechanical prose rather than
	// a hole in the page.
	it('falls back to the Planner\'s title when narration omitted this Task', () => {
		renderItem(<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} />);

		expect(screen.getByText(firedTask.title)).toBeDefined();
	});

	it('falls back to the title when the narration line is empty', () => {
		renderItem(
			<TaskItem
				task={firedTask}
				rulesById={rulesById}
				plantsById={plantsById}
				narrationText="   "
			/>,
		);

		expect(screen.getByText(firedTask.title)).toBeDefined();
	});

	it('names the Plant the Task is about', () => {
		renderItem(<TaskItem task={deferredTask} rulesById={rulesById} plantsById={plantsById} />);

		expect(screen.getByText('Brown Turkey fig')).toBeDefined();
	});

	it('renders no Plant line for a Task that names no Plant', () => {
		const yardWide: Task = {
			...firedTask,
			plantId: null,
			id: taskId(firedTask.ruleId, null),
		};

		renderItem(<TaskItem task={yardWide} rulesById={rulesById} plantsById={plantsById} />);

		expect(screen.queryByText('Front lawn')).toBeNull();
	});

	// A Plant the inventory has dropped is the same case as a Guard the rule set
	// has dropped: the Artifact recorded the id, so the id is what renders.
	it('falls back to the Plant id when the inventory does not carry it', () => {
		renderItem(
			<TaskItem task={firedTask} rulesById={rulesById} plantsById={new Map()} />,
		);

		expect(screen.getByText('front-lawn')).toBeDefined();
	});

	// WCAG 1.4.11 wants 3:1 where a border is what identifies a component, and #62
	// and #65 raised that requirement for Tasks. A hairline in --rule carries it
	// here: near-black on near-white, roughly 18.9:1. This world has no elevation
	// and no cards, so the boundary is the only thing doing the identifying.
	it('is identified by a boundary, and never by a raised surface', () => {
		const { container } = renderItem(
			<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} />,
		);

		const item = container.querySelector('li');
		expect(item?.className).toContain('border-rule');
		expect(item?.className).not.toContain('bg-card');
	});

	it('renders one li and nothing else at the top level', () => {
		const { container } = renderItem(
			<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} />,
		);

		const list = container.querySelector('ul');
		expect(list?.children.length).toBe(1);
		expect(list?.children[0]?.tagName).toBe('LI');
	});

	describe('the check-off box', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		// The tap starts the wait; the wait running out is what records.
		it('calls onComplete with the Task once the wait runs out, and not before', () => {
			vi.useFakeTimers();
			const onComplete = vi.fn();
			renderItem(
				<TaskItem
					task={firedTask}
					rulesById={rulesById}
					plantsById={plantsById}
					onComplete={onComplete}
				/>,
			);

			fireEvent.click(screen.getByRole('checkbox'));
			expect(onComplete).not.toHaveBeenCalled();

			act(() => {
				vi.advanceTimersByTime(RECORD_DELAY_MS);
			});

			expect(onComplete).toHaveBeenCalledTimes(1);
			expect(onComplete).toHaveBeenCalledWith(firedTask);
		});

		it('sends nothing when the second tap lands inside the wait', () => {
			vi.useFakeTimers();
			const onComplete = vi.fn();
			const onRecordCancel = vi.fn();
			renderItem(
				<TaskItem
					task={firedTask}
					rulesById={rulesById}
					plantsById={plantsById}
					onComplete={onComplete}
					onRecordCancel={onRecordCancel}
				/>,
			);

			fireEvent.click(screen.getByRole('checkbox'));
			expect(screen.getByText('Tap again to cancel')).toBeDefined();
			fireEvent.click(screen.getByRole('checkbox'));
			act(() => {
				vi.advanceTimersByTime(RECORD_DELAY_MS * 2);
			});

			expect(onComplete).not.toHaveBeenCalled();
			expect(onRecordCancel).toHaveBeenCalledWith(firedTask);
			expect(screen.getByRole('checkbox')).toHaveProperty('checked', false);
		});

		// Leaving the page mid-wait is a cancel. A record written after the row
		// is gone would be one the reader never saw land.
		it('records nothing when the row unmounts inside the wait', () => {
			vi.useFakeTimers();
			const onComplete = vi.fn();
			const view = renderItem(
				<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} onComplete={onComplete} />,
			);

			fireEvent.click(screen.getByRole('checkbox'));
			view.unmount();
			vi.advanceTimersByTime(RECORD_DELAY_MS);

			expect(onComplete).not.toHaveBeenCalled();
		});

		it('says in place that the sign-off was not saved when the write fails', async () => {
			renderItem(
				<TaskItem
					task={firedTask}
					rulesById={rulesById}
					plantsById={plantsById}
					recordDelayMs={0}
					onComplete={async () => {
						throw new Error('quota exceeded');
					}}
				/>,
			);

			await act(async () => {
				fireEvent.click(screen.getByRole('checkbox'));
				await new Promise(resolve => setTimeout(resolve, 0));
			});

			expect(screen.getByText(NOT_SAVED)).toBeDefined();
			expect(screen.getByRole('checkbox')).toHaveProperty('checked', false);
		});

		it('prints the recorded day under the evidence on a checked Task', () => {
			renderItem(
				<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} checked recordedOn="2026-09-25" />,
			);

			expect(screen.getByText('Recorded Sep 25 2026')).toBeDefined();
		});

		it('takes its checked state from the prop', () => {
			renderItem(
				<TaskItem
					task={firedTask}
					rulesById={rulesById}
					plantsById={plantsById}
					checked
				/>,
			);

			expect(screen.getByRole('checkbox')).toHaveProperty('checked', true);
		});

		// An Occurrence is append-only, so there is no un-record to send. A view
		// that fired onComplete on the way back down would ask the store to
		// record the work a second time.
		it('sends nothing when a checked box is clicked again', () => {
			const onComplete = vi.fn();
			renderItem(
				<TaskItem
					task={firedTask}
					rulesById={rulesById}
					plantsById={plantsById}
					checked
					onComplete={onComplete}
				/>,
			);

			fireEvent.click(screen.getByRole('checkbox'));

			expect(onComplete).not.toHaveBeenCalled();
		});

		// ADR 0002 makes a Deferral advice rather than a lock. Somebody who
		// watered the fig anyway has a right to record it.
		it('is still there on a deferred Task', () => {
			renderItem(<TaskItem task={deferredTask} rulesById={rulesById} plantsById={plantsById} />);

			expect(screen.getByRole('checkbox')).toBeDefined();
		});

		// The name points at visible text rather than repeating it in a label, which
		// is what keeps a second copy of the sentence out of the markup where it
		// would drift from the first. It covers the job name, the target and the
		// instruction, because Narration is optional and a row with the model off
		// may have no instruction line at all, and a name that pointed only at the
		// sentence would be empty exactly when the model is switched off.
		it('takes its accessible name from the visible work, not a duplicate label', () => {
			renderItem(
				<TaskItem
					task={firedTask}
					rulesById={rulesById}
					plantsById={plantsById}
					narrationText={firedNarration}
				/>,
			);

			const box = screen.getByRole('checkbox');
			expect(box.getAttribute('aria-labelledby')).toBeTruthy();
			expect(screen.getByRole('checkbox', { name: new RegExp(firedNarration.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeDefined();
			expect(screen.getAllByText(firedNarration).length).toBe(1);
		});

		// A control inside a `<summary>` fights the disclosure for the same click
		// and the same key press.
		it('sits outside the disclosure summary', () => {
			const { container } = renderItem(
				<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} />,
			);

			expect(container.querySelector('summary input')).toBeNull();
		});

		/*
		 * A `<label>` around the row would let a thumb resting on the instruction
		 * write a permanent record. The sign-off cell is the target, and a tap on
		 * the text does nothing to the yard.
		 */
		it('records nothing from a tap on the task text', () => {
			vi.useFakeTimers();
			const onComplete = vi.fn();
			const { container } = renderItem(
				<TaskItem
					task={firedTask}
					rulesById={rulesById}
					plantsById={plantsById}
					narrationText={firedNarration}
					onComplete={onComplete}
				/>,
			);

			expect(container.querySelector('label')).toBeNull();
			fireEvent.click(screen.getByText(firedNarration));
			vi.advanceTimersByTime(RECORD_DELAY_MS);

			expect(onComplete).not.toHaveBeenCalled();
		});

		// 2.75rem, which is 44px. Asserted on the class rather than on a measured
		// height because jsdom lays nothing out, so a geometric assertion here
		// would pass against an element of zero height. The e2e spec measures it.
		it('spends at least 44px on the row the sign-off cell spans', () => {
			const { container } = renderItem(
				<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} />,
			);

			expect(container.querySelector('li > div')?.className).toContain('min-h-11');
		});

		it('names the control by its verb, and points at the permanence note', () => {
			renderItem(
				<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} describedBy="note" />,
			);

			const box = screen.getByRole('checkbox', { name: /^Sign off /u });
			expect(box.getAttribute('aria-describedby')).toBe('note');
		});

		// Colour on a 16px square is one cue and the weakest one available. A
		// reader glancing at a phone in the sun gets a word instead.
		it('says the work is recorded in words, not only in the box', () => {
			renderItem(
				<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} checked />,
			);

			expect(screen.getByText('Recorded')).toBeDefined();
		});

		it('shows no recorded marker while the box is empty', () => {
			renderItem(<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} />);

			expect(screen.queryByText('Recorded')).toBeNull();
		});

		/*
		 * Unticking does nothing to the yard, by design: an Occurrence is
		 * append-only and #62's non-goals are explicit that it stays that way.
		 * What the page may not do is stay silent about it. A box that flips off
		 * and snaps back with no sentence beside it reads as a broken control
		 * rather than as a record that cannot be withdrawn.
		 */
		it('explains the refusal in place when a ticked box is clicked again', () => {
			renderItem(
				<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} checked />,
			);

			expect(screen.queryByText(UNDO_REFUSAL)).toBeNull();

			fireEvent.click(screen.getByRole('checkbox'));

			expect(screen.getByText(UNDO_REFUSAL)).toBeDefined();
		});

		it('tells the caller about the refused untick so it can be announced', () => {
			const onUndoAttempt = vi.fn();
			renderItem(
				<TaskItem
					task={firedTask}
					rulesById={rulesById}
					plantsById={plantsById}
					checked
					onUndoAttempt={onUndoAttempt}
				/>,
			);

			fireEvent.click(screen.getByRole('checkbox'));

			expect(onUndoAttempt).toHaveBeenCalledTimes(1);
			expect(onUndoAttempt).toHaveBeenCalledWith(firedTask);
		});

		it('leaves the refusal alone on a tick that has something to record', () => {
			const onUndoAttempt = vi.fn();
			renderItem(
				<TaskItem
					task={firedTask}
					rulesById={rulesById}
					plantsById={plantsById}
					onUndoAttempt={onUndoAttempt}
				/>,
			);

			fireEvent.click(screen.getByRole('checkbox'));

			expect(onUndoAttempt).not.toHaveBeenCalled();
			expect(screen.queryByText(UNDO_REFUSAL)).toBeNull();
		});
	});

	describe('the evidence drawer', () => {
		// #50 counted three visible tasks against zero visible citations. The
		// caller decides which one opens, because only the caller knows how many
		// are on the page.
		it('opens on load when the caller asks for it', () => {
			const { container } = renderItem(
				<TaskItem
					task={firedTask}
					rulesById={rulesById}
					plantsById={plantsById}
					citationOpen
				/>,
			);

			expect(container.querySelector('details')?.open).toBe(true);
		});

		it('stays closed by default', () => {
			const { container } = renderItem(
				<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} />,
			);

			expect(container.querySelector('details')?.open).toBe(false);
		});

		// The chevron carried no words, so nothing on the screen said the
		// evidence was there at all. The label is the promise the brief sentence
		// makes, in the brief sentence's own vocabulary.
		it('labels itself in words and names the Rule behind the Task', () => {
			const { container } = renderItem(
				<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} />,
			);

			const summary = container.querySelector('summary')?.textContent ?? '';
			expect(summary).toContain('Rule and evidence');
			expect(summary).toContain('Fall pre-emergent');
		});
	});

	describe('an approaching Task', () => {
		it('offers no check-off box', () => {
			renderItem(<TaskItem task={approachingTask} rulesById={rulesById} plantsById={plantsById} />);

			expect(screen.queryByRole('checkbox')).toBeNull();
		});

		// The row says this in the domain's own terms, in the place a reader is
		// already looking: the Citation line leads with Forecast, which separates a
		// day that is expected from a run that was observed. CONTEXT.md is explicit
		// that the two must never be confused.
		it('says on its face that its evidence is forecast, not observed', () => {
			renderItem(<TaskItem task={approachingTask} rulesById={rulesById} plantsById={plantsById} />);

			expect(screen.getByText(/^Forecast \//)).toBeDefined();
			expect(screen.queryByText(/Observed run/)).toBeNull();
		});

		// The projected date comes from CitationDisclosure's projection branch.
		// This spec still checks it, because the approaching treatment means
		// nothing if the day it is about never reaches the page. The expected
		// value is read off the Citation, so the two cannot drift.
		it('carries the projected date the Citation names', () => {
			const { container } = renderItem(
				<TaskItem task={approachingTask} rulesById={rulesById} plantsById={plantsById} />,
			);

			const projectedDate = approachingTask.citation.kind === 'threshold-projection'
				? approachingTask.citation.projectedDate
				: null;
			expect(projectedDate).not.toBeNull();
			expect(container.querySelector(`time[datetime="${projectedDate}"]`)).not.toBeNull();
		});
	});

	describe('what the Guards had to say', () => {
		it('names the Guard that held the work back and the condition that releases it', () => {
			renderItem(<TaskItem task={deferredTask} rulesById={rulesById} plantsById={plantsById} />);

			const deferral = deferredTask.deferrals[0];
			expect(deferral).toBeDefined();
			expect(screen.getByText('Rain expected')).toBeDefined();
			// Verbatim, per contract 10: this is the Guard's own `release` string,
			// and anything rewritten on the way to the screen is the interface
			// speaking for a Guard that already said what it meant.
			expect(screen.getByText(deferral?.releaseWhen ?? '')).toBeDefined();
		});

		it('names the Guard behind an Annotation and renders its text', () => {
			renderItem(<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} />);

			const annotation = firedTask.annotations[0];
			expect(annotation).toBeDefined();
			expect(screen.getByText('Water in after application')).toBeDefined();
			expect(screen.getByText(annotation?.text ?? '')).toBeDefined();
		});

		// The rule set moving on does not unsay what the Guard said. Same
		// argument citation.tsx makes for a Task whose own Rule has gone.
		it('falls back to the raw Guard id when the rule set has dropped the Guard', () => {
			const withoutGuard: ReadonlyMap<string, Rule> = new Map(
				[...rulesById].filter(([id]) => id !== 'rain-expected'),
			);

			renderItem(<TaskItem task={deferredTask} rulesById={withoutGuard} plantsById={plantsById} />);

			expect(screen.getByText('rain-expected')).toBeDefined();
			expect(screen.queryByText('Rain expected')).toBeNull();
		});

		it('renders no Guard line for a Task no Guard reached', () => {
			renderItem(<TaskItem task={approachingTask} rulesById={rulesById} plantsById={plantsById} />);

			expect(screen.queryByText(/held back by/i)).toBeNull();
			expect(screen.queryByText(/releases when/i)).toBeNull();
		});
	});

	// `rulesByIdMissingDeepWaterFig` mirrors the gap `data/artifact.json` ships
	// with today: a Task citing a Rule the seed does not carry.
	it('still renders a Task whose own Rule the rule set does not carry', () => {
		renderItem(
			<TaskItem
				task={deferredTask}
				rulesById={rulesByIdMissingDeepWaterFig}
				plantsById={plantsById}
			/>,
		);

		expect(screen.getByText(deferredTask.title)).toBeDefined();
		expect(screen.getByText(/not in the current rule set/i)).toBeDefined();
	});

	// The route owns the page's only h1 and its sections own the h2s, so a
	// heading in here would land at whatever depth its section happened to sit
	// at. tests/integration/smoke.spec.ts runs axe over the rendered page.
	it('contains no heading element', () => {
		const { container } = renderItem(
			<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} />,
		);

		expect(container.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
	});

	it('hides its decorative icons from assistive tech', () => {
		const { container } = renderItem(
			<TaskItem task={deferredTask} rulesById={rulesById} plantsById={plantsById} />,
		);

		for (const icon of container.querySelectorAll('svg')) {
			expect(icon.getAttribute('aria-hidden')).toBe('true');
		}
	});
});
