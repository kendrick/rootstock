import type { Task } from '@/planner/task';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeferredSection } from './deferred-section';
import { combinedNarratedArtifact, plantsById, rulesById } from './fixtures';

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
		expect(screen.getByText(/nothing is being held back/i)).toBeDefined();
		expect(container.querySelector('li')).toBeNull();
	});

	// The deferred Task's own title ('Deep water the fig') and its Rule's name
	// are the same string, and rule-summary renders the Rule's name inside the
	// disclosure body. So these two checks read the `<summary>` text
	// specifically—the one line narrationById is wired to—rather than
	// screen.getByText, which would also match the Rule name and fail on
	// ambiguity that has nothing to do with what this component wires up.
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

		expect(container.querySelector('summary')?.textContent).toContain('Custom narration for the fig.');
	});

	it('falls back to the title when narrationById has no entry for the Task', () => {
		const { container } = render(
			<DeferredSection tasks={[deferredTask]} rulesById={rulesById} plantsById={plantsById} />,
		);

		expect(container.querySelector('summary')?.textContent).toContain(deferredTask.title);
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

		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(onComplete).toHaveBeenCalledWith(deferredTask);
	});
});
