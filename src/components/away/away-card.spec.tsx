import type { Artifact, StatusRecord } from '@/artifact/artifact';
import type { Occurrence } from '@/planner/occurrence';
import { render, screen, within } from '@testing-library/react';
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
	nothingDelegableAwayArtifact,
	recordedNitrogenOccurrence,
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

/** The instruction on each row, without the numeral and the deadline line printed around it. */
function instructions(): string[] {
	return screen.getAllByRole('listitem').map(item => item.querySelector('p')?.textContent ?? '');
}
const CHEMICAL_TEXT = awayArtifact.narration?.tasks.find(entry => entry.taskId === chemicalTaskId)?.text ?? '';

/** The three ids the card withholds, each with the prose that must travel no further than the Plan. */
const WITHHELD = [
	{ id: chemicalTaskId, title: task(chemicalTaskId).title },
	{ id: undelegableNoTagTaskId, title: task(undelegableNoTagTaskId).title },
	{ id: deferredDelegableTaskId, title: task(deferredDelegableTaskId).title },
];

/**
 * No Occurrences unless a test passes some, rather than the committed seed, so
 * a line added to `src/seed/occurrences.json` can't quietly mark a fixture row
 * as done.
 */
function renderCard(artifact: Artifact, status: StatusRecord, now: Date, occurrences: Occurrence[] = []): HTMLElement {
	const { container } = render(<AwayCard artifact={artifact} status={status} now={now} occurrences={occurrences} />);
	return container;
}

describe('partitionForCard', () => {
	// Total and disjoint is the property the whole card rests on. The list and
	// the count both read this one result, so a Task that fell out of every
	// bucket would leave the yard without ever being mentioned—and nothing on
	// the page would look wrong.
	it('puts every Task in the Plan in exactly one bucket', () => {
		const { shown, ownerOnly, deferred, approaching } = partitionForCard(awayArtifact.plan.tasks);

		const sorted = [...shown, ...ownerOnly, ...deferred, ...approaching].map(each => each.id).sort();

		expect(sorted).toEqual(awayArtifact.plan.tasks.map(each => each.id).sort());
		expect(new Set(sorted).size).toBe(sorted.length);
	});

	it('shows the fired and delegable Tasks, and withholds the rest by reason', () => {
		const { shown, ownerOnly, deferred, approaching } = partitionForCard(awayArtifact.plan.tasks);

		expect(shown.map(each => each.id)).toEqual([delegableNarratedTaskId, delegableUnnarratedTaskId]);
		expect(ownerOnly.map(each => each.id)).toEqual([chemicalTaskId, undelegableNoTagTaskId]);
		expect(deferred.map(each => each.id)).toEqual([deferredDelegableTaskId]);
		expect(approaching).toEqual([]);
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

	// Undelegable work is the owner's either way. Counted as held, it would tell
	// the household it comes to them once conditions change.
	it('counts an undelegable Task as the owner\'s even when a Guard held it back', () => {
		const held = {
			...task(chemicalTaskId),
			status: 'deferred' as const,
			deferrals: [{ guardId: 'rain-expected', releaseWhen: 'the rain passes' }],
		};

		const { ownerOnly, deferred } = partitionForCard([held]);

		expect(ownerOnly.map(each => each.id)).toEqual([chemicalTaskId]);
		expect(deferred).toEqual([]);
	});

	// CONTEXT.md's Approaching Task entry: there is no work to do yet. Counting
	// it as withheld would tell the household about work that does not exist.
	it('leaves an approaching Task out of both withheld buckets', () => {
		const { shown, ownerOnly, deferred, approaching } = partitionForCard(approachingAwayArtifact.plan.tasks);

		expect(approaching).toHaveLength(1);
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

		expect(instructions()).toEqual([NARRATED_TEXT, task(delegableUnnarratedTaskId).title]);
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

		expect(container.textContent).toContain('2 more tasks are the owner\'s to do.');
		expect(container.textContent).toContain('1 more task is on hold until conditions change.');
		expect(container.textContent).toContain('This list isn\'t the whole week. The rest is the owner\'s to do or to decide.');

		for (const { id, title } of WITHHELD) {
			expect(container.textContent).not.toContain(title);
			expect(container.textContent).not.toContain(id);
		}
	});

	// ADR 0001's property, from the reader's side: switching the model off
	// changes the words and not the work. The same two Tasks render either way.
	it('falls back to the mechanical title when the model did not run', () => {
		const container = renderCard(unnarratedAwayArtifact, awayStatus, FRESH);

		expect(instructions()).toEqual([
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

	// Dated by the Plan, not the reader's clock, so the sheet still says which
	// week it was after days on a fridge. The fixture Plan is for 2026-09-11.
	it('names the yard and the Plan\'s week rather than the reason anyone is reading this', () => {
		renderCard(awayArtifact, awayStatus, FRESH);

		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Yard tasks, week of Sep 11');
		expect(screen.getByText('No. 2026-254 · Stub')).toBeDefined();
	});

	/*
	 * The only dates the list may carry are the work's own deadlines: a Window
	 * Rule's last day, from the Rule and the Plan, and nothing else. A date that
	 * came from anywhere else could be a trip date (ADR 0004). `last-nitrogen`
	 * closes 10-01, a Thursday in 2026, and the fig's Cadence work has no last
	 * day.
	 */
	it('dates each row by the work\'s own deadline and by nothing else', () => {
		renderCard(awayArtifact, awayStatus, FRESH);

		const rows = screen.getAllByRole('listitem').map(item => item.querySelectorAll('p')[1]?.textContent);
		expect(rows).toEqual(['By Thu Oct 1', 'This week']);

		const text = screen.getByRole('list').textContent ?? '';
		expect(text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/gi)).toEqual(['Oct']);
		expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
		expect(text).not.toMatch(/\b\d{1,2}\/\d{1,2}\b/);
	});

	// The year is what a sheet found in a drawer next spring needs most.
	it('prints the year on the line saying when the list was made', () => {
		const container = renderCard(awayArtifact, awayStatus, FRESH);

		const made = container.querySelector('time')?.parentElement?.textContent ?? '';
		expect(made).toMatch(/^This list was made .*2026/);
		expect(made).not.toContain('Generated');
	});

	// The only button on the card is the print trigger, and it is a control
	// over the browser rather than over the Plan: it cannot mark a Task done,
	// which stays true even though #63 adds it. The squares beside each task are
	// a border on an empty span, not a `[type="checkbox"]`, exactly so a helper's
	// pen is what fills them in rather than a click this card would have to sync.
	it('carries no input, checkbox, or link for anyone to tick, only a control to print', () => {
		const container = renderCard(awayArtifact, awayStatus, FRESH);

		expect(container.querySelectorAll('input, [type="checkbox"], a')).toHaveLength(0);

		const buttons = container.querySelectorAll('button');
		expect(buttons).toHaveLength(1);
		expect(buttons[0]?.textContent).toMatch(/print/i);
	});

	// One box per shown Task, matching the count the earlier partition test
	// already pins, and none of them a real checkbox—see the test above.
	it('draws an empty box beside every shown Task for a pen to fill in', () => {
		renderCard(awayArtifact, awayStatus, FRESH);

		for (const item of screen.getAllByRole('listitem')) {
			expect(within(item).getByTestId('pen-box').childElementCount).toBe(0);
		}
	});

	// The returned sheet is only worth something to the owner if it says who
	// did the work and when, so every row keeps a blank cell for it.
	it('numbers every row and leaves a write-in cell beside its box', () => {
		renderCard(awayArtifact, awayStatus, FRESH);

		const items = screen.getAllByRole('listitem');
		expect(items.map(item => item.firstElementChild?.textContent)).toEqual(['01', '02']);
		for (const item of items) {
			const writeIn = item.lastElementChild;
			expect(writeIn?.getAttribute('aria-hidden')).toBe('true');
			expect(writeIn?.textContent).toBe('');
			expect(writeIn?.classList.contains('print:block')).toBe(true);
		}
	});

	// DESIGN.md's Type section: the instruction is prose, and prose is
	// Assistant. The deadline under it is a reading, and readings are mono.
	it('sets the instruction in the prose face and the deadline in mono', () => {
		renderCard(awayArtifact, awayStatus, FRESH);

		const [instruction, deadline] = screen.getAllByRole('listitem')[0]!.querySelectorAll('p');
		expect(instruction?.classList.contains('font-mono')).toBe(false);
		expect(instruction?.classList.contains('text-body')).toBe(true);
		expect(deadline?.classList.contains('font-mono')).toBe(true);
	});

	// Safari drops list semantics once list-style is none, and Tailwind's
	// preflight sets it.
	it('keeps list semantics on the task list', () => {
		renderCard(awayArtifact, awayStatus, FRESH);

		expect(screen.getByRole('list').getAttribute('role')).toBe('list');
	});

	// 44px, the target size #50 set for the owner's own controls.
	it('makes the print button at least 44px tall', () => {
		renderCard(awayArtifact, awayStatus, FRESH);

		expect(screen.getByRole('button', { name: /print/i }).classList.contains('min-h-11')).toBe(true);
	});

	// #63's fix: a printed sheet with no date is indistinguishable from one
	// three weeks old. Checked across bands, because the line has to survive
	// even the one render—fresh, no failures—where StalenessBanner says nothing
	// at all.
	it('carries a generation date on every render, fresh or not', () => {
		for (const now of [FRESH, STALE]) {
			const container = renderCard(awayArtifact, awayStatus, now);
			const time = container.querySelector('time');

			expect(time).not.toBeNull();
			expect(time?.getAttribute('dateTime')).toBe(awayArtifact.generatedAt);
		}
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

	/*
	 * The week the count exists for. Every fired Task is the owner's, so the
	 * household's list is empty and the yard still needs work. Telling this
	 * reader the yard needs nothing, directly above a line saying it needs
	 * more, is how a pre-emergent window closes with everyone believing the
	 * card.
	 */
	it('does not call the yard finished when it is holding work back', () => {
		const container = renderCard(nothingDelegableAwayArtifact, awayStatus, FRESH);

		expect(screen.queryAllByRole('listitem')).toHaveLength(0);
		expect(container.textContent).not.toContain('The yard doesn\'t need anything');
		expect(container.textContent).toContain('Nothing on the list for you this week.');
		expect(container.textContent).toContain('2 more tasks are the owner\'s to do.');
		expect(container.textContent).toContain('1 more task is on hold until conditions change.');
	});

	// The closing sentence points at no list, because on the week above there is
	// no list for it to point at.
	it('reports what it withheld without pointing at a list that may not be there', () => {
		const withList = renderCard(awayArtifact, awayStatus, FRESH);
		const withoutList = renderCard(nothingDelegableAwayArtifact, awayStatus, FRESH);

		for (const container of [withList, withoutList]) {
			expect(container.textContent).toContain('This list isn\'t the whole week.');
			expect(container.textContent).not.toContain('list above');
		}
	});

	/*
	 * Plain language is hard to assert in general, so this asserts the half that
	 * is mechanical: every word a household member would have to look up reaches
	 * this card through a Task the card withholds. If one shows up, something
	 * leaked rather than something got worded badly.
	 */
	it('leaks none of the vocabulary that only a withheld Task carries', () => {
		// The trap has to be set for the assertion to mean anything: a withheld
		// title really does carry the word being swept for.
		expect(WITHHELD.some(({ title }) => title.toLowerCase().includes('pre-emergent'))).toBe(true);

		const container = renderCard(awayArtifact, awayStatus, FRESH);
		const text = (container.textContent ?? '').toLowerCase();

		for (const word of ['pre-emergent', 'herbicide', 'chemical']) {
			expect(text).not.toContain(word);
		}
	});

	it('says so plainly when the yard needs nothing, and counts nothing it is not withholding', () => {
		const container = renderCard(approachingAwayArtifact, awayStatus, APPROACHING_FRESH);

		expect(container.textContent).toContain('The yard doesn\'t need anything this week.');
		expect(screen.queryAllByRole('listitem')).toHaveLength(0);
		expect(container.textContent).not.toContain('the owner\'s to do');
		expect(container.textContent).not.toContain('on hold');
		expect(container.textContent).not.toContain('isn\'t the whole week');
	});

	// The gate fails closed here for the same reason it does on every other
	// route, and it matters more here: a half-rendered card is a list somebody
	// works from. The household gets a step it can take, never the field path.
	it('renders the household\'s error state and no task at all when the Artifact will not parse', () => {
		const container = renderCard({ ...awayArtifact, generatedAt: 'yesterday' }, awayStatus, FRESH);

		const alert = screen.getByRole('alert');
		expect(alert.textContent).toContain('Ask whoever gave it to you.');
		expect(alert.textContent).not.toContain('generatedAt');
		expect(alert.textContent).not.toContain('data/artifact.json');
		expect(screen.queryByRole('list')).toBeNull();
		expect(container.textContent).not.toContain(NARRATED_TEXT);
		expect(container.textContent).not.toContain(task(delegableUnnarratedTaskId).title);
	});

	/*
	 * jsdom renders no pixels, so this proves the print and phone rules are on
	 * the elements that need them and nothing more. Whether the card actually
	 * fits a page and reads at 375px is Playwright's to answer, and #16 owns it.
	 */
	// Two requirements, and the mechanism carrying one of them changed. This sheet
	// is read on a phone and on paper, so it has to scale down and it has to print
	// in ink. The type used to step up at the `sm` breakpoint; it now runs on the
	// world's clamp-based tokens, which scale continuously and need no breakpoint,
	// so the assertion follows the tokens. The print rules are unchanged: a card
	// whose ink is a theme colour prints grey, and a task split across two sheets
	// is the one way a printed line gets missed.
	it('scales for a phone and prints in ink', () => {
		renderCard(awayArtifact, awayStatus, FRESH);

		const heading = screen.getByRole('heading', { level: 1 });
		// The border belongs to the ruled box around the heads and the rows.
		const list = screen.getByRole('list').parentElement!;
		const first = screen.getAllByRole('listitem')[0];

		expect(heading.classList.contains('text-display')).toBe(true);
		expect(heading.classList.contains('print:text-black')).toBe(true);
		expect(list.classList.contains('print:border-black')).toBe(true);
		expect(first?.classList.contains('print:break-inside-avoid')).toBe(true);
		expect(first?.classList.contains('print:border-black')).toBe(true);
	});

	// The card is the copy torn off the ticket, so it is printed on the copy sheet
	// rather than the top one. `copy-sheet` is what redefines the ground for this
	// subtree, and losing it would put the household's copy on the owner's stock.
	it('renders on the copy sheet', () => {
		const container = renderCard(awayArtifact, awayStatus, FRESH);

		expect(container.querySelector('.copy-sheet')).not.toBeNull();
	});
});

/*
 * The P1 from the 2026-09-28 critique. A Window Rule keeps firing until its
 * window closes, recorded or not, so a card that never reads Occurrences
 * hands the household work the owner already did. Asserted as the printed
 * row reads: the words on it and whether its pen box is still empty.
 */
describe('recorded work on the card', () => {
	function row(text: string): HTMLElement {
		const item = screen.getAllByRole('listitem').find(candidate => candidate.textContent?.includes(text));
		if (item === undefined) {
			throw new Error(`no row carries '${text}'`);
		}
		return item;
	}

	it('prints recorded delegable work as done, not as an open box', () => {
		render(<AwayCard artifact={awayArtifact} status={awayStatus} now={FRESH} occurrences={[recordedNitrogenOccurrence]} />);

		const recorded = row(NARRATED_TEXT);
		expect(recorded.textContent).toContain('Recorded Sep 10');
		expect(within(recorded).getByTestId('pen-box').childElementCount).toBeGreaterThan(0);
	});

	it('leaves work nobody recorded open', () => {
		render(<AwayCard artifact={awayArtifact} status={awayStatus} now={FRESH} occurrences={[recordedNitrogenOccurrence]} />);

		const open = row(task(delegableUnnarratedTaskId).title);
		expect(open.textContent).not.toContain('Recorded');
		expect(within(open).getByTestId('pen-box').childElementCount).toBe(0);
	});
});
