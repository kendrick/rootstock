import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { combinedNarratedArtifact } from './fixtures';
import { WeekSummary } from './week-summary';

/**
 * Read off the fixture rather than retyped. The field this component exists to
 * render went unrendered for the life of the project precisely because nothing
 * referred to it, and a hardcoded sentence here would recreate that gap one
 * level down.
 */
function fixtureSummary(): string {
	const summary = combinedNarratedArtifact.narration?.summary;
	if (summary === undefined || summary.trim() === '') {
		throw new Error('the this-week fixture Artifact no longer narrates a summary: this component has nothing to render');
	}
	return summary;
}

const SUMMARY = fixtureSummary();

describe('weekSummary', () => {
	it('renders the summary the Narration carries', () => {
		render(<WeekSummary summary={SUMMARY} />);

		expect(screen.getByText(SUMMARY)).toBeDefined();
	});

	it('names its own section so the slot is findable', () => {
		render(<WeekSummary summary={SUMMARY} />);

		const region = screen.getByRole('region', { name: 'The week in the yard' });
		expect(region.textContent).toContain(SUMMARY);
	});

	// ADR 0001 treats a run without Narration as a whole output rather than a
	// degraded one, so there is nothing to apologise for and no heading to hang
	// over the gap.
	it('renders nothing at all for an Artifact the model never narrated', () => {
		const { container } = render(<WeekSummary summary={null} />);

		expect(container.firstChild).toBeNull();
	});

	it('renders nothing for a summary that is only whitespace', () => {
		const { container } = render(<WeekSummary summary="   " />);

		expect(container.firstChild).toBeNull();
	});

	it('renders nothing when handed no summary at all', () => {
		const { container } = render(<WeekSummary />);

		expect(container.firstChild).toBeNull();
	});

	// The route owns the page's only h1, and the groups beside this one are all
	// h2s. tests/integration/this-week.spec.ts runs axe over the rendered page,
	// where a skipped level is a violation.
	it('sits at h2, beside the groups rather than above them', () => {
		render(<WeekSummary summary={SUMMARY} />);

		expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('The week in the yard');
	});
});
