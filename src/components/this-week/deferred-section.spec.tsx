import type { Task } from '@/planner/task';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeferredSection } from './deferred-section';
import { combinedNarratedArtifact, plantsById, rulesById } from './fixtures';
import { permanenceNote, RECORD_DELAY_MS } from './permanence';

/**
 * The one deferred Task the fixture Artifact carries, read off it rather than
 * retyped—the same reasoning task-item.spec.tsx gives for doing this, so a
 * Task shape that changes upstream fails here by name instead of quietly
 * rendering against a stale copy of itself.
 */
function fixtureDeferredTask(): Task {
	const task = combinedNarratedArtifact.plan.tasks.find(candidate => candidate.status === 'deferred');
	if (task === undefined) {
		throw new Error('the this-week fixture Artifact no longer carries a deferred Task');
	}
	return task;
}

const deferredTask = fixtureDeferredTask();

/** The Task's own row, which `TaskItem` renders as the first child of its `<li>`, ahead of the evidence drawer. */
function taskRowText(container: HTMLElement): string {
	return container.querySelector('li')?.firstElementChild?.textContent ?? '';
}

describe('deferredSection', () => {
	it('renders the deferred Task with its Guard name and release text', () => {
		render(<DeferredSection tasks={[deferredTask]} rulesById={rulesById} plantsById={plantsById} />);

		// rulesById names the rain-expected Guard 'Rain expected'; the raw id
		// would be the fallback citation.tsx and task-item.tsx use for a Guard
		// the rule set has dropped, which is not this case.
		expect(screen.getByText('Rain expected')).toBeDefined();
		expect(screen.getByText(deferredTask.deferrals[0]?.releaseWhen ?? '')).toBeDefined();
	});

	// The contract's whole point: this component hands the Task to TaskItem
	// rather than re-rendering the title or the Guard line by hand, so the
	// evidence a reader can expand is the same disclosure a fired Task gets.
	it('composes TaskItem rather than re-rendering the Task by hand', () => {
		const { container } = render(
			<DeferredSection tasks={[deferredTask]} rulesById={rulesById} plantsById={plantsById} />,
		);

		expect(container.querySelector('li')).not.toBeNull();
		expect(container.querySelector('details')).not.toBeNull();
		expect(container.querySelector('summary')).not.toBeNull();
	});

	it('renders an h2 naming the section, not the route h1', () => {
		render(<DeferredSection tasks={[deferredTask]} rulesById={rulesById} plantsById={plantsById} />);

		const heading = screen.getByRole('heading', { level: 2 });
		expect(heading.textContent).not.toBe('');
	});

	// ADR 0002: a section that disappears when nothing is held back is
	// indistinguishable from one that failed to render, which is the same
	// ambiguity a deleted Task would produce. Unlike Advisories, this
	// component has to say something even with an empty list.
	it('states in words that nothing is held back when the list is empty', () => {
		const { container } = render(
			<DeferredSection tasks={[]} rulesById={rulesById} plantsById={plantsById} />,
		);

		expect(container.querySelector('section')).not.toBeNull();
		expect(screen.getByText(/nothing is holding work back/i)).toBeDefined();
		expect(container.querySelector('li')).toBeNull();
	});

	// The empty text names the Guards that can hold work back, read off the rule
	// set it is handed, and only those: an annotating Guard adds a note and holds
	// nothing. An example Guard nobody wrote is the copy version of an invented
	// Task.
	it('names only the rules that can hold work back, read off the rule set', () => {
		const deferring = [...rulesById.values()].filter(rule => rule.kind === 'guard' && rule.effect === 'defer');
		const annotating = [...rulesById.values()].filter(rule => rule.kind === 'guard' && rule.effect === 'annotate');
		render(<DeferredSection tasks={[]} rulesById={rulesById} plantsById={plantsById} />);

		const text = screen.getByText(/nothing is holding work back/i).textContent ?? '';
		for (const rule of deferring) {
			expect(text).toContain(rule.name);
		}
		for (const rule of annotating) {
			expect(text).not.toContain(rule.name);
		}
		expect(text).not.toMatch(/until evening|until spring/i);
	});

	// The deferred Task's own title ('Deep water the fig') and its Rule's name
	// are the same string, and rule-summary renders the Rule's name inside the
	// disclosure body, where the disclosure label now names it too. So these two
	// checks read the Task row specifically—the one line narrationById is wired
	// to—rather than screen.getByText, which would also match the Rule name and
	// fail on ambiguity that has nothing to do with what this component wires up.
	it('resolves narration through narrationById by task id', () => {
		const narrationById = new Map([[deferredTask.id, 'Custom narration for the fig.']]);

		const { container } = render(
			<DeferredSection
				tasks={[deferredTask]}
				rulesById={rulesById}
				plantsById={plantsById}
				narrationById={narrationById}
			/>,
		);

		expect(taskRowText(container)).toContain('Custom narration for the fig.');
	});

	it('falls back to the title when narrationById has no entry for the Task', () => {
		const { container } = render(
			<DeferredSection tasks={[deferredTask]} rulesById={rulesById} plantsById={plantsById} />,
		);

		expect(taskRowText(container)).toContain(deferredTask.title);
	});

	/*
	 * ADR 0002's machinery is the most distinctive thing this app does, and it
	 * has never had a live example on the deployed site, because holding work
	 * back needs rain in the forecast. An empty week is the only chance this
	 * section gets to explain itself, and "no Guard has deferred any work" does
	 * not take it: that is a glossary term aimed at a reader without the
	 * glossary.
	 */
	it('explains what holding work back means while it has nothing to show', () => {
		render(<DeferredSection tasks={[]} rulesById={rulesById} plantsById={plantsById} />);

		const copy = screen.getByText(/nothing is holding work back/i).textContent ?? '';

		// ADR 0002's argument in household words: the task stays put, with the
		// reason on it, rather than disappearing.
		expect(copy).toMatch(/stays on this page/i);
		expect(copy).toMatch(/reason/i);
		expect(copy).not.toContain('Guard');
	});

	it('names neither Guards nor deferrals at a household reader when work is held', () => {
		render(<DeferredSection tasks={[deferredTask]} rulesById={rulesById} plantsById={plantsById} />);

		const copy = screen.getByRole('region', { name: 'Held back' })
			.querySelector('p')
			?.textContent ?? '';

		expect(copy).not.toContain('Guard');
		expect(copy).not.toContain('Deferral');
	});

	// The section is flat and the Tasks inside it carry the boundary. #62 settled
	// where that boundary belongs: on the work, not on the container around it.
	it('renders flat, leaving the boundary to the Tasks inside it', () => {
		const { container } = render(
			<DeferredSection tasks={[deferredTask]} rulesById={rulesById} plantsById={plantsById} />,
		);

		const section = container.querySelector('section');
		expect(section?.className).not.toContain('bg-muted');
		expect(section?.className).not.toContain('bg-card');
		expect(container.querySelector('li')?.className).toContain('border-rule');
	});

	/*
	 * ADR 0002 keeps the box on a held Task, because a Deferral is advice rather
	 * than a lock. That box writes the same permanent Occurrence every other box
	 * writes, so #62's "before or as it is written" criterion reaches this list
	 * too. A warning that only sat over 'Ready now' would leave a reader ticking
	 * held work with nothing on screen to tell them it sticks.
	 */
	it('warns that a tick cannot be taken back, over held work that can be ticked', () => {
		render(<DeferredSection tasks={[deferredTask]} rulesById={rulesById} plantsById={plantsById} />);

		expect(screen.getByRole('checkbox')).toBeDefined();
		expect(screen.getByText(permanenceNote(null))).toBeDefined();
	});

	it('drops the warning when there is no held work to tick', () => {
		render(<DeferredSection tasks={[]} rulesById={rulesById} plantsById={plantsById} />);

		expect(screen.queryByRole('checkbox')).toBeNull();
		expect(screen.queryByText(permanenceNote(null))).toBeNull();
	});

	it('opens the evidence on the Task the caller named', () => {
		const { container } = render(
			<DeferredSection
				tasks={[deferredTask]}
				rulesById={rulesById}
				plantsById={plantsById}
				openCitationId={deferredTask.id}
			/>,
		);

		expect(container.querySelector('details')?.open).toBe(true);
	});

	it('leaves the evidence closed for a Task the caller did not name', () => {
		const { container } = render(
			<DeferredSection
				tasks={[deferredTask]}
				rulesById={rulesById}
				plantsById={plantsById}
				openCitationId="some-other-task"
			/>,
		);

		expect(container.querySelector('details')?.open).toBe(false);
	});

	it('passes the refused untick through to its caller', () => {
		const onUndoAttempt = vi.fn();
		render(
			<DeferredSection
				tasks={[deferredTask]}
				rulesById={rulesById}
				plantsById={plantsById}
				completedIds={new Set([deferredTask.id])}
				onUndoAttempt={onUndoAttempt}
			/>,
		);

		fireEvent.click(screen.getByRole('checkbox'));

		expect(onUndoAttempt).toHaveBeenCalledWith(deferredTask);
	});

	it('checks the box when completedIds names the Task', () => {
		render(
			<DeferredSection
				tasks={[deferredTask]}
				rulesById={rulesById}
				plantsById={plantsById}
				completedIds={new Set([deferredTask.id])}
			/>,
		);

		expect(screen.getByRole('checkbox')).toHaveProperty('checked', true);
	});

	it('leaves the box unchecked when completedIds does not name the Task', () => {
		render(
			<DeferredSection
				tasks={[deferredTask]}
				rulesById={rulesById}
				plantsById={plantsById}
				completedIds={new Set(['some-other-task'])}
			/>,
		);

		expect(screen.getByRole('checkbox')).toHaveProperty('checked', false);
	});

	it('passes onComplete through to the checkbox', () => {
		vi.useFakeTimers();
		const onComplete = vi.fn();
		render(
			<DeferredSection
				tasks={[deferredTask]}
				rulesById={rulesById}
				plantsById={plantsById}
				onComplete={onComplete}
			/>,
		);

		fireEvent.click(screen.getByRole('checkbox'));
		act(() => {
			vi.advanceTimersByTime(RECORD_DELAY_MS);
		});
		vi.useRealTimers();

		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(onComplete).toHaveBeenCalledWith(deferredTask);
	});
});
