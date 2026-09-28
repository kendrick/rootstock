import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WithheldCount } from './withheld-count';

const NOT_EVERYTHING = 'This card isn\'t the whole week.';

describe('withheldCount', () => {
	// A zero line is worse than no line: it trains a reader to skip the block,
	// and the block only matters on the week it is not zero.
	it('renders nothing when there is nothing to report', () => {
		const { container } = render(<WithheldCount ownerOnly={0} deferred={0} />);

		expect(container.innerHTML).toBe('');
	});

	it('counts the owner\'s own work, plural past one', () => {
		const { container } = render(<WithheldCount ownerOnly={2} deferred={0} />);

		expect(container.textContent).toContain('2 more tasks are the owner\'s to do.');
	});

	it('drops the plural at one', () => {
		const { container } = render(<WithheldCount ownerOnly={1} deferred={0} />);

		expect(container.textContent).toContain('1 more task is the owner\'s to do.');
	});

	it('says held-back work is held back, plural past one', () => {
		const { container } = render(<WithheldCount ownerOnly={0} deferred={2} />);

		expect(container.textContent).toContain('2 more tasks are held back until conditions change.');
	});

	it('drops that plural at one too', () => {
		const { container } = render(<WithheldCount ownerOnly={0} deferred={1} />);

		expect(container.textContent).toContain('1 more task is held back until conditions change.');
	});

	// Each reason stands on its own line only when it has a count behind it.
	// "0 tasks are held back" beside a real number reads as noise a reader learns
	// to skip past.
	it('leaves out the reason that has no count behind it', () => {
		const { container } = render(<WithheldCount ownerOnly={3} deferred={0} />);

		expect(container.textContent).not.toContain('held back');
	});

	// The sentence that earns the whole component. Without it the counts read as
	// trivia rather than as the reason not to walk away from a finished list.
	it('says the card is not the whole week, in every state that renders', () => {
		const counts: [number, number][] = [[1, 0], [0, 1], [2, 3]];

		for (const [ownerOnly, deferred] of counts) {
			const { container } = render(<WithheldCount ownerOnly={ownerOnly} deferred={deferred} />);
			expect(container.textContent).toContain(NOT_EVERYTHING);
		}
	});

	// The card ends on whose the rest is. Held work is the owner's to decide,
	// so the household never reads it as theirs once the weather turns.
	it('ends on the owner, in the sense each count gives the work', () => {
		const ending = (ownerOnly: number, deferred: number) =>
			render(<WithheldCount ownerOnly={ownerOnly} deferred={deferred} />).container.lastElementChild?.lastElementChild?.textContent;

		expect(ending(2, 0)).toBe(`${NOT_EVERYTHING} The rest is the owner's to do.`);
		expect(ending(0, 1)).toBe(`${NOT_EVERYTHING} The rest is the owner's to decide.`);
		expect(ending(2, 1)).toBe(`${NOT_EVERYTHING} The rest is the owner's to do or to decide.`);
	});

	// An exact match rather than a list of things not to say. The point of the
	// count is that it identifies nothing, and any wording that crept in later—a
	// task, a plant, a chemical—would fail here rather than needing to have been
	// anticipated.
	it('renders the counts and the ending and nothing else', () => {
		const { container } = render(<WithheldCount ownerOnly={2} deferred={1} />);

		expect(container.textContent).toBe(
			`2 more tasks are the owner's to do.1 more task is held back until conditions change.${NOT_EVERYTHING} The rest is the owner's to do or to decide.`,
		);
	});

	// jsdom cannot prove this prints legibly; it can prove the print rules are on
	// the element that needs them. Real paper is Playwright's to prove, in #16.
	it('carries the print rules that keep it off a second sheet and readable in ink', () => {
		const { container } = render(<WithheldCount ownerOnly={1} deferred={1} />);
		const block = container.firstElementChild;

		expect(block?.classList.contains('print:break-inside-avoid')).toBe(true);
		expect(block?.classList.contains('print:text-black')).toBe(true);
		// The size used to step up at the `sm` breakpoint. It runs on the world's
		// clamp-based scale now, which sizes itself continuously and needs none.
		expect(block?.classList.contains('text-evidence')).toBe(true);
	});
});
