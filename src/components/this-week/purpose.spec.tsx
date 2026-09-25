import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { seedYard } from '@/seed';
import { Purpose } from './purpose';

/** The rendered copy as one string, so an assertion reads the sentence rather than the spans it is built from. */
function copy(container: HTMLElement): string {
	return container.textContent ?? '';
}

describe('purpose', () => {
	/*
	 * #50's brief sentence, turned into a test: "Above the fold in a desktop
	 * browser, This Week says what it is, this week's plan for one yard with the
	 * rule and the reading behind every line, before it says what to do." Three
	 * clauses, three assertions, all of them on the words rather than on the
	 * layout, because the layout half is what the Playwright spec measures.
	 */
	it('says it is one yard, and that every task names its rule and its evidence', () => {
		const { container } = render(<Purpose />);

		expect(copy(container)).toMatch(/one yard/i);
		expect(copy(container)).toMatch(/rule/i);
		expect(copy(container)).toMatch(/evidence/i);
	});

	// A Window Task fires on a date and a first-time Cadence Task on no reading
	// at all, so "the reading that fired it" is false for most rows.
	it('does not claim every task fired on a reading', () => {
		const { container } = render(<Purpose />);

		expect(copy(container)).not.toMatch(/\breading\b/i);
	});

	// A fresh plan shows its date nowhere else: the staleness banner is silent.
	it('names the day the plan was made for', () => {
		const { container } = render(<Purpose planned="2026-09-25" />);

		expect(copy(container)).toContain('Planned Sep 25');
	});

	// The ticket head names the region; repeating it here cost the phone a line.
	it('leaves the region to the ticket head', () => {
		const { container } = render(<Purpose planned="2026-09-25" />);

		expect(copy(container)).not.toContain(seedYard.region.name);
	});

	// The route owns the page's only h1 and the sections under it own the h2s.
	// This is the paragraph between them and has no business being either.
	it('adds no heading', () => {
		const { container } = render(<Purpose />);

		expect(container.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
		expect(screen.queryByRole('heading')).toBeNull();
	});
});
