import type { Artifact, StatusRecord } from '@/artifact/artifact';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StalenessBanner } from '@/components/staleness-banner';
import { AwayCard, partitionForCard } from './away-card';
import {
	approachingAwayArtifact,
	awayArtifact,
	awayStatus,
	chemicalTaskId,
	deferredDelegableTaskId,
	delegableNarratedTaskId,
	delegableUnnarratedTaskId,
	failingAwayStatus,
	undelegableNoTagTaskId,
	unnarratedAwayArtifact,
} from './fixtures';

const HOUR_MS = 60 * 60 * 1000;

function hoursAfter(generatedAt: string, hours: number): Date {
	return new Date(Date.parse(generatedAt) + hours * HOUR_MS);
}

/**
 * Every render below pins its own instant. The fixture's `generatedAt` is
 * fixed and the wall clock is not, so a card rendered against the real clock
 * would carry a staleness banner on some afternoons and none on others—and
 * the banner is the one part of this view that legitimately prints a date.
 */
const FRESH = hoursAfter(awayArtifact.generatedAt, 12);
const STALE = hoursAfter(awayArtifact.generatedAt, 48);
const APPROACHING_FRESH = hoursAfter(approachingAwayArtifact.generatedAt, 12);

function task(id: string) {
	const found = awayArtifact.plan.tasks.find(candidate => candidate.id === id);
	if (found === undefined) {
		throw new Error(`fixture task '${id}' is missing: this spec reads its title off the Plan rather than retyping it`);
	}
	return found;
}

const NARRATED_TEXT = awayArtifact.narration?.tasks.find(entry => entry.taskId === delegableNarratedTaskId)?.text ?? '';
const CHEMICAL_TEXT = awayArtifact.narration?.tasks.find(entry => entry.taskId === chemicalTaskId)?.text ?? '';

/** The three ids the card withholds, each with the prose that must travel no further than the Plan. */
const WITHHELD = [
	{ id: chemicalTaskId, title: task(chemicalTaskId).title },
	{ id: undelegableNoTagTaskId, title: task(undelegableNoTagTaskId).title },
	{ id: deferredDelegableTaskId, title: task(deferredDelegableTaskId).title },
];

function renderCard(artifact: Artifact, status: StatusRecord, now: Date): HTMLElement {
	const { container } = render(<AwayCard artifact={artifact} status={status} now={now} />);
	return container;
}

describe('partitionForCard', () => {
	// Total and disjoint is the property the whole card rests on. The list and
	// the count both read this one result, so a Task that fell out of every
	// bucket would leave the yard without ever being mentioned—and nothing on
	// the page would look wrong.
	it('puts every Task in the Plan in exactly one bucket', () => {
		const { shown, ownerOnly, deferred, notYet } = partitionForCard(awayArtifact.plan.tasks);

		const sorted = [...shown, ...ownerOnly, ...deferred, ...notYet].map(each => each.id).sort();

		expect(sorted).toEqual(awayArtifact.plan.tasks.map(each => each.id).sort());
		expect(new Set(sorted).size).toBe(sorted.length);
	});

	it('shows the fired and delegable Tasks, and withholds the rest by reason', () => {
		const { shown, ownerOnly, deferred, notYet } = partitionForCard(awayArtifact.plan.tasks);

		expect(shown.map(each => each.id)).toEqual([delegableNarratedTaskId, delegableUnnarratedTaskId]);
		expect(ownerOnly.map(each => each.id)).toEqual([chemicalTaskId, undelegableNoTagTaskId]);
		expect(deferred.map(each => each.id)).toEqual([deferredDelegableTaskId]);
		expect(notYet).toEqual([]);
	});

	// A deferred Task is nobody's work this week, so `delegable` has no say in
	// where it lands. Sorting this one by its flag would put it on the household's
	// list with the Guard's reason stripped off.
	it('counts a delegable Task as deferred when a Guard held it back', () => {
		const { shown, deferred } = partitionForCard(awayArtifact.plan.tasks);

		expect(task(deferredDelegableTaskId).delegable).toBe(true);
		expect(shown.map(each => each.id)).not.toContain(deferredDelegableTaskId);
		expect(deferred.map(each => each.id)).toContain(deferredDelegableTaskId);
	});

	// CONTEXT.md's Approaching Task entry: there is no work to do yet. Counting
	// it as withheld would tell the household about work that does not exist.
	it('leaves an approaching Task out of both withheld buckets', () => {
		const { shown, ownerOnly, deferred, notYet } = partitionForCard(approachingAwayArtifact.plan.tasks);

		expect(notYet).toHaveLength(1);
		expect(shown).toEqual([]);
		expect(ownerOnly).toEqual([]);
		expect(deferred).toEqual([]);
	});
});

describe('awayCard', () => {
	// Written prose and mechanical prose sit in one list with nothing marking
	// either, which is ADR 0001's property from the reader's side: the first item
	// is the model's sentence, the second the Planner's, and a reader cannot tell
	// which is which.
	it('renders the delegable, fired Tasks and no others', () => {
		renderCard(awayArtifact, awayStatus, FRESH);

		const items = screen.getAllByRole('listitem');

		expect(items).toHaveLength(2);
		expect(items[0]?.textContent).toBe(NARRATED_TEXT);
		expect(items[1]?.textContent).toBe(task(delegableUnnarratedTaskId).title);
	});

	/*
	 * #15's central case. `fall-pre-emergent` sets `delegable: true` on its own
	 * Rule and the tag policy narrows it anyway, so this asserts the card reads
	 * the stamped flag rather than the Rule's claim—and that the model's prose
	 * for it, which the fixture deliberately carries, never reaches the page
	 * either. Herbicide on a household member's list is the failure this whole
	 * view is built around.
	 */
	it('keeps a chemical Task off the card even though its Rule asked to delegate it', () => {
		const container = renderCard(awayArtifact, awayStatus, FRESH);

		expect(container.textContent).not.toContain(task(chemicalTaskId).title);
		expect(container.textContent).not.toContain(CHEMICAL_TEXT);
		expect(container.textContent).not.toContain(chemicalTaskId);
	});

	/*
	 * The row that tells the two implementations apart. `mulch-around-the-fig`
	 * is undelegable and carries no safety tag at all, so a card filtering on
	 * `tags.includes('chemical')` would render it and pass every other test in
	 * this file.
	 */
	it('withholds an undelegable Task that carries no tag to match on', () => {
		const container = renderCard(awayArtifact, awayStatus, FRESH);

		expect(task(undelegableNoTagTaskId).tags).not.toContain('chemical');
		expect(container.textContent).not.toContain(task(undelegableNoTagTaskId).title);
	});

	it('withholds a deferred Task even when it is delegable', () => {
		const container = renderCard(awayArtifact, awayStatus, FRESH);

		expect(container.textContent).not.toContain(task(deferredDelegableTaskId).title);
	});

	// The summary is the subtle leak. The fixture's summary runs straight through
	// the week, weed preventer included, so a card that printed it would hand over
	// the one Task the rest of this logic spent its time withholding. Advisories go
	// for the plainer reason: CONTEXT.md says one never reaches this card.
	it('renders neither the summary nor an advisory', () => {
		const container = renderCard(awayArtifact, awayStatus, FRESH);

		expect(awayArtifact.narration).not.toBeNull();
		expect(container.textContent).not.toContain(awayArtifact.narration?.summary);
		expect(container.textContent).not.toContain(awayArtifact.narration?.advisories[0]?.text);
	});

	it('counts what it withheld, by reason, naming none of it', () => {
		const container = renderCard(awayArtifact, awayStatus, FRESH);

		expect(container.textContent).toContain('2 tasks are for the owner to do.');
		expect(container.textContent).toContain('1 task is waiting for conditions to change.');
		expect(container.textContent).toContain('The list above is not everything the yard needs this week.');

		for (const { id, title } of WITHHELD) {
			expect(container.textContent).not.toContain(title);
			expect(container.textContent).not.toContain(id);
		}
	});

	// ADR 0001's property, from the reader's side: switching the model off
	// changes the words and not the work. The same two Tasks render either way.
	it('falls back to the mechanical title when the model did not run', () => {
		const container = renderCard(unnarratedAwayArtifact, awayStatus, FRESH);

		const items = screen.getAllByRole('listitem');

		expect(items.map(item => item.textContent)).toEqual([
			task(delegableNarratedTaskId).title,
			task(delegableUnnarratedTaskId).title,
		]);
		expect(container.textContent).not.toContain(NARRATED_TEXT);
	});

	/*
	 * ADR 0004's one fact: whether the house is empty. The heading names the
	 * yard, nothing on the page says anyone is travelling, and the sweep runs
	 * over every state this component renders rather than the happy one.
	 * textContent and not innerHTML, so a class name or a file path can never
	 * launder a pass.
	 */
	it('says nothing about anyone being away, in any state it renders', () => {
		const states: [string, Artifact, StatusRecord, Date][] = [
			['narrated', awayArtifact, awayStatus, FRESH],
			['un-narrated', unnarratedAwayArtifact, awayStatus, FRESH],
			['stale, with failed runs', awayArtifact, failingAwayStatus, STALE],
			['nothing to do', approachingAwayArtifact, awayStatus, APPROACHING_FRESH],
			['malformed', { ...awayArtifact, generatedAt: 'yesterday' }, awayStatus, FRESH],
		];

		for (const [, artifact, status, now] of states) {
			const container = renderCard(artifact, status, now);
			const text = container.textContent ?? '';

			for (const word of ['away', 'trip', 'travel', 'back on']) {
				expect(text.toLowerCase()).not.toContain(word);
			}
		}
	});

	it('names the yard rather than the reason anyone is reading this', () => {
		renderCard(awayArtifact, awayStatus, FRESH);

		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Yard tasks this week');
	});

	/*
	 * Scoped to the list on purpose. The staleness banner does print the
	 * Artifact's generation time, and that is the age of the data rather than
	 * anything about a trip, so the assertion that matters is that no date
	 * reaches the work itself.
	 */
	it('puts no date in the list of tasks', () => {
		renderCard(awayArtifact, awayStatus, FRESH);

		const text = screen.getByRole('list').textContent ?? '';

		expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
		expect(text).not.toMatch(/\b\d{1,2}\/\d{1,2}\b/);
		expect(text).not.toMatch(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i);
		expect(text).not.toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b/i);
	});

	it('carries no input, button, or checkbox for anyone to tick', () => {
		const container = renderCard(awayArtifact, awayStatus, FRESH);

		expect(container.querySelectorAll('input, button, [type="checkbox"], a')).toHaveLength(0);
	});

	it('puts the staleness banner above the first task', () => {
		renderCard(awayArtifact, failingAwayStatus, STALE);

		const banner = screen.getByRole('status');
		const first = screen.getAllByRole('listitem')[0];

		expect(banner.compareDocumentPosition(first!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	/*
	 * The prominent variant is only observable as the class list the banner
	 * builds for it, so this compares against that component's own two outputs
	 * rather than freezing a class name here. A restyle of the banner moves both
	 * sides of the comparison together; dropping the `prominent` prop moves only
	 * one.
	 */
	it('asks the banner for its loud variant, the one that has to survive on paper', () => {
		renderCard(awayArtifact, failingAwayStatus, STALE);
		const banner = screen.getByRole('status');

		const loud = render(
			<StalenessBanner prominent generatedAt={awayArtifact.generatedAt} status={failingAwayStatus} now={STALE} />,
		).container.querySelector('[role="status"]');
		const quiet = render(
			<StalenessBanner generatedAt={awayArtifact.generatedAt} status={failingAwayStatus} now={STALE} />,
		).container.querySelector('[role="status"]');

		expect(banner.className).toBe(loud?.className);
		expect(banner.className).not.toBe(quiet?.className);
	});

	it('says so plainly when the yard needs nothing, and counts nothing it is not withholding', () => {
		const container = renderCard(approachingAwayArtifact, awayStatus, APPROACHING_FRESH);

		expect(container.textContent).toContain('Nothing in the yard needs doing this week.');
		expect(screen.queryAllByRole('listitem')).toHaveLength(0);
		expect(container.textContent).not.toContain('for the owner to do');
		expect(container.textContent).not.toContain('waiting for conditions to change');
		expect(container.textContent).not.toContain('The list above is not everything');
	});

	// The gate fails closed here for the same reason it does on every other
	// route, and it matters more here: a half-rendered card is a list somebody
	// works from.
	it('renders the error state and no task at all when the Artifact will not parse', () => {
		const container = renderCard({ ...awayArtifact, generatedAt: 'yesterday' }, awayStatus, FRESH);

		expect(screen.getByRole('alert').textContent).toContain('generatedAt');
		expect(screen.queryByRole('list')).toBeNull();
		expect(container.textContent).not.toContain(NARRATED_TEXT);
		expect(container.textContent).not.toContain(task(delegableUnnarratedTaskId).title);
	});

	/*
	 * jsdom renders no pixels, so this proves the print and phone rules are on
	 * the elements that need them and nothing more. Whether the card actually
	 * fits a page and reads at 375px is Playwright's to answer, and #16 owns it.
	 */
	it('carries the print and phone-width rules on the elements that need them', () => {
		renderCard(awayArtifact, awayStatus, FRESH);

		const heading = screen.getByRole('heading', { level: 1 });
		const list = screen.getByRole('list');
		const first = screen.getAllByRole('listitem')[0];

		expect(heading.classList.contains('sm:text-3xl')).toBe(true);
		expect(heading.classList.contains('print:text-black')).toBe(true);
		expect(list.classList.contains('print:border-black')).toBe(true);
		expect(first?.classList.contains('sm:text-lg')).toBe(true);
		expect(first?.classList.contains('print:break-inside-avoid')).toBe(true);
	});
});
