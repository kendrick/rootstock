import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WithheldCount } from './withheld-count';

const REASON = 'The yard needs more this week than this page shows.';

describe('withheldCount', () => {
	// A zero line is worse than no line: it trains a reader to skip the block,
	// and the block only matters on the week it is not zero.
	it('renders nothing when there is nothing to report', () => {
		const { container } = render(<WithheldCount ownerOnly={0} deferred={0} />);

		expect(container.innerHTML).toBe('');
	});

	it('counts the owner\'s own work, plural past one', () => {
		const { container } = render(<WithheldCount ownerOnly={2} deferred={0} />);

		expect(container.textContent).toContain('2 tasks are for the owner to do.');
	});

	it('drops the plural at one', () => {
		const { container } = render(<WithheldCount ownerOnly={1} deferred={0} />);

		expect(container.textContent).toContain('1 task is for the owner to do.');
	});

	it('says what deferred work is waiting on, plural past one', () => {
		const { container } = render(<WithheldCount ownerOnly={0} deferred={2} />);

		expect(container.textContent).toContain('2 tasks are waiting for conditions to change.');
	});

	it('drops that plural at one too', () => {
		const { container } = render(<WithheldCount ownerOnly={0} deferred={1} />);

		expect(container.textContent).toContain('1 task is waiting for conditions to change.');
	});

	// Each reason stands on its own line only when it has a count behind it.
	// "0 tasks are waiting" beside a real number reads as noise a reader learns to
	// skip past.
	it('leaves out the reason that has no count behind it', () => {
		const { container } = render(<WithheldCount ownerOnly={3} deferred={0} />);

		expect(container.textContent).not.toContain('waiting for conditions');
	});

	// The sentence that earns the whole component. Without it the counts read as
	// trivia rather than as the reason not to walk away from a finished list.
	it('says why the counts are there at all, in every state that renders', () => {
		const counts: [number, number][] = [[1, 0], [0, 1], [2, 3]];

		for (const [ownerOnly, deferred] of counts) {
			const { container } = render(<WithheldCount ownerOnly={ownerOnly} deferred={deferred} />);
			expect(container.textContent).toContain(REASON);
		}
	});

	// An exact match rather than a list of things not to say. The point of the
	// count is that it identifies nothing, and any wording that crept in later—a
	// task, a plant, a chemical—would fail here rather than needing to have been
	// anticipated.
	it('renders the counts and the reason and nothing else', () => {
		const { container } = render(<WithheldCount ownerOnly={2} deferred={1} />);

		expect(container.textContent).toBe(
			`2 tasks are for the owner to do.1 task is waiting for conditions to change.${REASON}`,
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
