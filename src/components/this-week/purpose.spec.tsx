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
	it('says it is one yard, and that every task names its rule and its reading', () => {
		const { container } = render(<Purpose />);

		expect(copy(container)).toMatch(/one yard/i);
		expect(copy(container)).toMatch(/rule/i);
		expect(copy(container)).toMatch(/reading/i);
	});

	// The region is the one fact here that could go stale, and the yard record
	// already holds it. A hardcoded city would keep rendering after the yard
	// moved.
	it('names the region off the yard rather than out of the copy', () => {
		const { container } = render(<Purpose />);

		expect(copy(container)).toContain(seedYard.region.name);
	});

	it('takes a region from its caller', () => {
		const { container } = render(<Purpose region="Denton County, Texas" />);

		expect(copy(container)).toContain('Denton County, Texas');
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
