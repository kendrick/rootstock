import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { Artifact } from '@/artifact/artifact';
import type { Occurrence } from '@/planner/occurrence';
import type { Task } from '@/planner/task';
import type { Store } from '@/store/store';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { localDate } from '@/planner/dates';
import { occurrenceSchema } from '@/planner/occurrence';
import { seedPlants, seedRules, seedTagPolicy, seedYard } from '@/seed';
import { createFakeStore } from '@/store/fake-store';
import { combinedNarratedArtifact, combinedUnnarratedArtifact, okStatus, plants, rules } from './fixtures';
import { PERMANENCE_NOTE, UNDO_REFUSAL } from './permanence';
import { ThisWeek } from './this-week';

/**
 * A Store with nothing recorded in it, or with the Occurrences a caller hands
 * over. `createFakeStore` rather than `openBrowserStore` because this component
 * takes its Store through a prop so that a spec never has to stand up IndexedDB
 * to find out what a checkbox does.
 */
function fakeStore(occurrences: Occurrence[] = []): Store {
	return createFakeStore({
		yard: seedYard,
		plants: seedPlants,
		rules: seedRules,
		occurrences,
		tagPolicy: seedTagPolicy,
	});
}

/**
 * Renders and lets the Occurrence load settle.
 *
 * The history arrives through an effect, so the first paint shows every box
 * unchecked whatever the Store holds. Flushing here is what makes the
 * assertions below read the render the Store produced rather than the one
 * before it answered.
 */
async function mount(element: ReactElement): Promise<RenderResult> {
	const view = render(element);
	await act(async () => {});
	return view;
}

/** The fixture Plan narrowed to the statuses one test cares about, spread so nothing else about the Artifact moves. */
function artifactWithStatuses(statuses: readonly Task['status'][]): Artifact {
	return {
		...combinedNarratedArtifact,
		plan: {
			...combinedNarratedArtifact.plan,
			tasks: combinedNarratedArtifact.plan.tasks.filter(task => statuses.includes(task.status)),
		},
	};
}

/**
 * The model's line for the first Task it narrated, and a Task it narrated not
 * at all. Both are read off the fixture rather than retyped: the fallback to
 * `title` is only proven by a Task the narration really leaves out, and a
 * hard-coded pair here would keep passing after the fixture stopped having one.
 */
function narratedLine(): string {
	const line = combinedNarratedArtifact.narration?.tasks[0]?.text;
	if (line === undefined) {
		throw new Error('the this-week fixture Artifact no longer narrates a Task: the narration path has nothing to prove');
	}
	return line;
}

function unnarratedTask(): Task {
	const narrated = new Set((combinedNarratedArtifact.narration?.tasks ?? []).map(entry => entry.taskId));
	const task = combinedNarratedArtifact.plan.tasks.find(candidate => !narrated.has(candidate.id));
	if (task === undefined) {
		throw new Error('the this-week fixture Artifact now narrates every Task: the title fallback has nothing to prove');
	}
	return task;
}

const NARRATED_LINE = narratedLine();
const UNNARRATED_TASK = unnarratedTask();

/**
 * One line per Task row, which is where the Task's own text lands: `TaskItem`
 * opens every `<li>` with the row that carries the box and the sentence, and
 * puts the evidence in a `<details>` after it. Reading the row rather than the
 * whole `<li>` is what keeps a Rule's name, which renders inside the
 * disclosure and often matches the Task's title word for word, out of these
 * assertions.
 */
function taskLines(container: HTMLElement): string[] {
	return [...container.querySelectorAll('li')].map(item => item.firstElementChild?.textContent ?? '');
}

function readyBox(): HTMLInputElement {
	const ready = screen.getByRole('region', { name: 'Ready now' });
	const boxes = within(ready).getAllByRole('checkbox');
	const box = boxes[0];
	if (box === undefined) {
		throw new Error('no check-off box in the ready group');
	}
	return box as HTMLInputElement;
}

/**
 * An instant the given number of days after the Artifact was generated, derived
 * rather than written down so these tests do not depend on the day they run or
 * on the fixture keeping its current timestamp.
 */
function daysAfterGeneration(days: number): Date {
	return new Date(Date.parse(combinedNarratedArtifact.generatedAt) + days * 24 * 60 * 60 * 1000);
}

/**
 * The element the de-emphasis lands on: the Task groups and the held-back
 * section share one wrapper, and the advisories sit outside it. Reached through
 * the group rather than by position, so a sibling added above the wrapper cannot
 * move this assertion onto the wrong node.
 */
function taskListWrapper(): HTMLElement {
	const wrapper = screen.getByRole('region', { name: 'Ready now' }).parentElement;
	if (wrapper === null) {
		throw new Error('the ready group no longer sits inside a wrapper');
	}
	return wrapper;
}

/** The one live region on the route. Found by its politeness rather than by a role, because `StalenessBanner` already owns `role="status"` on this page. */
function liveRegion(container: HTMLElement): string {
	return container.querySelector('[aria-live="polite"]')?.textContent ?? '';
}

function fullPage(store: Store): ReactElement {
	return (
		<ThisWeek
			artifact={combinedNarratedArtifact}
			status={okStatus}
			rules={rules}
			plants={plants}
			store={store}
		/>
	);
}

describe('thisWeek', () => {
	it('renders a group for fired work, one for approaching work, the held-back section, and the advisories', async () => {
		await mount(fullPage(fakeStore()));

		expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual([
			'The week in the yard',
			'Ready now',
			'Approaching',
			'Held back',
			'Also observed',
		]);
	});

	// The route owns the page's only h1 and `tests/integration/smoke.spec.ts`
	// asserts there is exactly one. A second one here would pass every test in
	// this file and fail the axe run over the built export.
	it('leaves the h1 to the route', async () => {
		await mount(fullPage(fakeStore()));

		expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
	});

	// CONTEXT.md keeps an Approaching Task apart from fired work because a
	// forecast can be revised. The missing check-off box is the other half of
	// that: there is nothing to record about work nothing has called for yet.
	it('splits the Plan by status and gives the approaching Task no box to tick', async () => {
		await mount(fullPage(fakeStore()));

		const ready = screen.getByRole('region', { name: 'Ready now' });
		const approaching = screen.getByRole('region', { name: 'Approaching' });

		expect(within(ready).getAllByRole('listitem')).toHaveLength(2);
		expect(within(approaching).getAllByRole('listitem')).toHaveLength(1);
		expect(within(approaching).queryByRole('checkbox')).toBeNull();
	});

	it('renders the model line for a narrated Task and the Planner title for one it left out', async () => {
		const { container } = await mount(fullPage(fakeStore()));

		const lines = taskLines(container);

		expect(lines.some(line => line.includes(NARRATED_LINE))).toBe(true);
		expect(lines.some(line => line.includes(UNNARRATED_TASK.title))).toBe(true);
	});

	// ADR 0001 treats an unnarrated Artifact as a first-class output rather than
	// a degraded one, so the page has to be whole without the model: every Task
	// keeps its mechanical title, and nothing is left labelled with prose that
	// never arrived.
	it('falls back to every Task title when the model never ran', async () => {
		const { container } = await mount(
			<ThisWeek
				artifact={combinedUnnarratedArtifact}
				status={okStatus}
				rules={rules}
				plants={plants}
				store={fakeStore()}
			/>,
		);

		const lines = taskLines(container);

		expect(lines.some(line => line.includes(NARRATED_LINE))).toBe(false);
		for (const task of combinedUnnarratedArtifact.plan.tasks) {
			expect(lines.some(line => line.includes(task.title))).toBe(true);
		}
		expect(screen.queryByRole('region', { name: 'Also observed' })).toBeNull();
	});

	// Composition, not presentation: `deferred-section.spec.tsx` proves what that
	// section renders. What this asserts is that the deferred Task reaches it
	// with the Guard resolvable and its narration line attached, which is what
	// the two maps and `narrationById` are threaded through for.
	it('hands the deferred Task to the held-back section with its Guard and its narration', async () => {
		await mount(fullPage(fakeStore()));

		const held = screen.getByRole('region', { name: 'Held back' });
		const deferred = combinedNarratedArtifact.plan.tasks.find(task => task.status === 'deferred');
		const narration = combinedNarratedArtifact.narration?.tasks
			.find(entry => entry.taskId === deferred?.id)
			?.text;

		expect(within(held).getByText('Rain expected')).toBeDefined();
		expect(within(held).getByText(narration ?? '')).toBeDefined();
	});

	it('records an Occurrence the schema accepts when a box is ticked', async () => {
		const store = fakeStore();
		await mount(fullPage(store));

		await act(async () => {
			fireEvent.click(readyBox());
		});

		const stored = await store.list('occurrences');
		const occurrence = stored[0]?.record;

		expect(stored).toHaveLength(1);
		expect(occurrence?.ruleId).toBe('fall-pre-emergent');
		expect(occurrence?.plantId).toBe('front-lawn');
		expect(occurrence?.source).toBe('browser');
		// Parsed rather than eyeballed field by field. `completedAt` is built from
		// the Plan's calendar date, and a bare date would satisfy every assertion
		// above while failing the schema the store and the Planner both read
		// through.
		expect(() => occurrenceSchema.parse(occurrence)).not.toThrow();
	});

	// The day has to come from the Plan and survive the trip back. `cadence-rule.ts`
	// reads `completedAt` through `localDate` to count its interval, so an instant
	// that lands on the previous local day would have the next run measuring from a
	// day the work did not happen on.
	it('dates the Occurrence to the Plan rather than to the clock', async () => {
		const store = fakeStore();
		await mount(fullPage(store));

		await act(async () => {
			fireEvent.click(readyBox());
		});

		const completedAt = (await store.list('occurrences'))[0]?.record.completedAt ?? '';

		expect(localDate(completedAt, 'America/Chicago')).toBe(combinedNarratedArtifact.plan.asOf);
	});

	/*
	 * The reload-survival criterion, and the reason checked state is never a flag
	 * in component state. Two mounts against one Store: the second knows nothing
	 * the first did except what the first wrote down, so a box that comes back
	 * ticked proves the answer is living in the Occurrence history rather than in
	 * a React state variable that a refresh would take with it.
	 */
	it('brings the box back checked on a second mount against the same store', async () => {
		const store = fakeStore();
		const first = await mount(fullPage(store));

		await act(async () => {
			fireEvent.click(readyBox());
		});
		expect(readyBox().checked).toBe(true);

		first.unmount();
		await mount(fullPage(store));

		expect(readyBox().checked).toBe(true);
	});

	// The factory half of the prop, which is the shape the default takes:
	// `openBrowserStore` is a function because IndexedDB cannot be opened until a
	// browser exists. Every other test in this file passes a Store as a value.
	it('accepts a factory for the store and reads the history it opens', async () => {
		const earlier: Occurrence = {
			id: 'fall-pre-emergent-front-lawn-2026-09-11',
			ruleId: 'fall-pre-emergent',
			plantId: 'front-lawn',
			completedAt: '2026-09-11T12:00:00Z',
			recordedAt: '2026-09-11T12:05:00Z',
			source: 'browser',
		};
		const store = fakeStore([earlier]);

		await mount(
			<ThisWeek
				artifact={combinedNarratedArtifact}
				status={okStatus}
				rules={rules}
				plants={plants}
				store={async () => store}
			/>,
		);

		expect(readyBox().checked).toBe(true);
	});

	// Two things at once: the seed defaults, reached by leaving both props off, and the message a
	// Citation gets when its Rule is not in the rule set it is read against. The second is worth
	// holding onto even while the committed Artifact cites only Rules that exist, because an
	// Artifact outlives the seed that produced it and a Rule can be retired between the run that
	// cited it and the next read.
	it('defaults its rule set and inventory to the seed data', async () => {
		await mount(
			<ThisWeek artifact={combinedNarratedArtifact} status={okStatus} store={fakeStore()} />,
		);

		expect(screen.getByText(/not in the current rule set/)).toBeDefined();
	});

	it('says so in words when the Plan holds no work at all', async () => {
		await mount(
			<ThisWeek
				artifact={artifactWithStatuses([])}
				status={okStatus}
				rules={rules}
				plants={plants}
				store={fakeStore()}
			/>,
		);

		expect(screen.getByText('Nothing in the yard is due this week.')).toBeDefined();
	});

	/*
	 * #12's de-emphasized state. The instant is pinned with `now` so the band is a
	 * property of the test rather than of the day it runs on: eight days past the
	 * Artifact's own `generatedAt` is past the seven-day line `staleness()` draws.
	 *
	 * The assertion looks for muted tokens because an arbitrary opacity is a
	 * contrast claim nothing has checked, and `tests/integration/smoke.spec.ts`
	 * runs axe over this page. The custom-property override is the half that
	 * reaches the children, which set `text-foreground` on their own headings and
	 * task text.
	 */
	it('de-emphasizes the task list once the Artifact has expired', async () => {
		await mount(
			<ThisWeek
				artifact={combinedNarratedArtifact}
				status={okStatus}
				rules={rules}
				plants={plants}
				store={fakeStore()}
				now={daysAfterGeneration(8)}
			/>,
		);

		const wrapper = taskListWrapper();

		expect(wrapper.className).toContain('text-muted-foreground');
		expect(wrapper.className).toContain('[--foreground:var(--muted-foreground)]');

		// The held-back section is inside the de-emphasis and the advisories are
		// not: an Advisory is not part of a Plan, so it has no staleness to inherit.
		expect(wrapper.contains(screen.getByRole('region', { name: 'Held back' }))).toBe(true);
		expect(wrapper.contains(screen.getByRole('region', { name: 'Also observed' }))).toBe(false);
	});

	it('leaves the task list at full weight while the Artifact is still current', async () => {
		await mount(
			<ThisWeek
				artifact={combinedNarratedArtifact}
				status={okStatus}
				rules={rules}
				plants={plants}
				store={fakeStore()}
				now={daysAfterGeneration(1)}
			/>,
		);

		expect(taskListWrapper().className).not.toContain('text-muted-foreground');
	});

	/*
	 * #50: `narrationSchema.summary` is required, its own describe() says it is
	 * read before any individual task, and grepping the components for a render
	 * site returned nothing. It was generated, validated and committed on every
	 * run and read by no one.
	 */
	it('renders the narration summary in its own slot above the groups', async () => {
		const { container } = await mount(fullPage(fakeStore()));

		const summary = combinedNarratedArtifact.narration?.summary ?? '';
		expect(summary).not.toBe('');

		const slot = screen.getByRole('region', { name: 'The week in the yard' });
		expect(slot.textContent).toContain(summary);

		// Above the first task, because that is the position the field was
		// written for and the reason it is required.
		const firstTask = container.querySelector('li');
		expect(firstTask).not.toBeNull();
		expect(slot.compareDocumentPosition(firstTask as Node) & Node.DOCUMENT_POSITION_FOLLOWING)
			.toBeTruthy();
	});

	it('renders no summary slot for an Artifact the model never narrated', async () => {
		await mount(
			<ThisWeek
				artifact={combinedUnnarratedArtifact}
				status={okStatus}
				rules={rules}
				plants={plants}
				store={fakeStore()}
			/>,
		);

		expect(screen.queryByRole('region', { name: 'The week in the yard' })).toBeNull();
	});

	/*
	 * ADR 0001 calls the cited-Task property the architecturally interesting
	 * one, and #50 found it fully present in the DOM and entirely absent from
	 * the screen: three visible tasks, zero open disclosures. One open, not
	 * three—the panel is tall, and three of them would push the list off the
	 * fold to demonstrate what one demonstrates.
	 */
	it('opens the first Task\'s evidence on load and leaves the rest closed', async () => {
		const { container } = await mount(fullPage(fakeStore()));

		const open = [...container.querySelectorAll('details[open]')];
		expect(open).toHaveLength(1);

		const firstFired = combinedNarratedArtifact.plan.tasks.find(task => task.status === 'fired');
		expect(firstFired).toBeDefined();

		const ready = screen.getByRole('region', { name: 'Ready now' });
		const firstItem = within(ready).getAllByRole('listitem')[0];
		expect(firstItem?.contains(open[0] as Node)).toBe(true);
	});

	// Nothing fired and nothing approaching still leaves held work with a
	// Citation worth demonstrating, so the open panel falls to it rather than
	// to nothing.
	it('opens the held-back Task\'s evidence when nothing else is on the page', async () => {
		const { container } = await mount(
			<ThisWeek
				artifact={artifactWithStatuses(['deferred'])}
				status={okStatus}
				rules={rules}
				plants={plants}
				store={fakeStore()}
			/>,
		);

		const open = container.querySelectorAll('details[open]');
		expect(open).toHaveLength(1);
		expect(screen.getByRole('region', { name: 'Held back' }).contains(open[0] as Node)).toBe(true);
	});

	// #62: marking a task done has to say the record is permanent before or as
	// it is written. This is the before half, over the group that carries the
	// boxes.
	it('warns that a tick cannot be taken back, over the group that has boxes', async () => {
		await mount(fullPage(fakeStore()));

		const ready = screen.getByRole('region', { name: 'Ready now' });
		expect(within(ready).getByText(PERMANENCE_NOTE)).toBeDefined();
	});

	it('drops the warning when the group has no work to tick', async () => {
		await mount(
			<ThisWeek
				artifact={artifactWithStatuses([])}
				status={okStatus}
				rules={rules}
				plants={plants}
				store={fakeStore()}
			/>,
		);

		expect(screen.queryByText(PERMANENCE_NOTE)).toBeNull();
	});

	/*
	 * The write landed in IndexedDB and nothing said so out loud. A sighted
	 * reader watching the box got one cue; a screen-reader user got no
	 * confirmation the yard had recorded anything at all.
	 *
	 * Empty before the click, because a live region has to be in the document
	 * before its content changes for a screen reader to announce what lands in
	 * it.
	 */
	it('announces the Occurrence in a polite live region once the Store agrees', async () => {
		const store = fakeStore();
		const { container } = await mount(fullPage(store));

		expect(liveRegion(container)).toBe('');

		await act(async () => {
			fireEvent.click(readyBox());
		});

		expect(liveRegion(container)).toContain('Recorded:');
		// The same policy sentence the refusal carries, so a reader hears one
		// account of the append-only log whichever way they arrived at it.
		expect(liveRegion(container)).toMatch(/nothing here to undo/i);
	});

	it('announces the refusal when a reader tries to untick', async () => {
		const store = fakeStore();
		const { container } = await mount(fullPage(store));

		await act(async () => {
			fireEvent.click(readyBox());
		});
		await act(async () => {
			fireEvent.click(readyBox());
		});

		expect(liveRegion(container)).toBe(UNDO_REFUSAL);
		// The non-goal, held: unticking says something and writes nothing.
		expect(await store.list('occurrences')).toHaveLength(1);
		expect(readyBox().checked).toBe(true);
	});

	// The other half of the surface inversion #62 records. The Tasks are the
	// raised blocks now; the two sections that carry the least weight are not.
	it('leaves the held-back and advisory sections off the raised surface', async () => {
		await mount(fullPage(fakeStore()));

		for (const name of ['Held back', 'Also observed']) {
			const section = screen.getByRole('region', { name });
			expect(section.className).not.toContain('bg-card');
			expect(section.className).not.toContain('bg-muted');
		}
	});

	// The other half of `TaskGroup`'s empty contract, and the case the shipped
	// Artifact is in: no approaching Task at all. A heading over an empty
	// look-ahead reads as a Task that vanished.
	it('renders no approaching group when nothing is approaching', async () => {
		await mount(
			<ThisWeek
				artifact={artifactWithStatuses(['fired', 'deferred'])}
				status={okStatus}
				rules={rules}
				plants={plants}
				store={fakeStore()}
			/>,
		);

		expect(screen.queryByRole('region', { name: 'Approaching' })).toBeNull();
		expect(screen.getByRole('region', { name: 'Ready now' })).toBeDefined();
	});
});
