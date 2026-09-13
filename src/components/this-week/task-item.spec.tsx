import type { ReactElement } from 'react';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { taskId } from '@/planner/task';
import { combinedNarratedArtifact, plantsById, rulesById, rulesByIdMissingDeepWaterFig } from './fixtures';
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

	it('renders one li and nothing else at the top level', () => {
		const { container } = renderItem(
			<TaskItem task={firedTask} rulesById={rulesById} plantsById={plantsById} />,
		);

		const list = container.querySelector('ul');
		expect(list?.children.length).toBe(1);
		expect(list?.children[0]?.tagName).toBe('LI');
	});

	describe('the check-off box', () => {
		it('calls onComplete with the Task', () => {
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

			expect(onComplete).toHaveBeenCalledTimes(1);
			expect(onComplete).toHaveBeenCalledWith(firedTask);
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

		it('takes its accessible name from the one visible copy of the task text', () => {
			renderItem(
				<TaskItem
					task={firedTask}
					rulesById={rulesById}
					plantsById={plantsById}
					narrationText={firedNarration}
				/>,
			);

			expect(screen.getByRole('checkbox', { name: firedNarration })).toBeDefined();
			// Pointing at the visible text is what keeps a second copy of the
			// sentence out of the markup, where it would drift from the first.
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
	});

	describe('an approaching Task', () => {
		it('offers no check-off box', () => {
			renderItem(<TaskItem task={approachingTask} rulesById={rulesById} plantsById={plantsById} />);

			expect(screen.queryByRole('checkbox')).toBeNull();
		});

		it('says on its face that it has not fired', () => {
			renderItem(<TaskItem task={approachingTask} rulesById={rulesById} plantsById={plantsById} />);

			expect(screen.getByText('Approaching')).toBeDefined();
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
