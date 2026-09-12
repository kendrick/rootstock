import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Advisories } from './advisories';
import { combinedNarratedArtifact, combinedUnnarratedArtifact } from './fixtures';

describe('advisories', () => {
	it('renders the one advisory combinedNarratedArtifact carries', () => {
		const advisories = combinedNarratedArtifact.narration?.advisories ?? [];
		render(<Advisories advisories={advisories} />);

		expect(screen.getByText(
			'The crape myrtle by the north fence is dropping leaves early. Worth a look before the next mow.',
		)).toBeDefined();
	});

	// combinedUnnarratedArtifact carries narration: null, so a caller has
	// nothing to spread but an empty array—this is the shape the route
	// actually hands the component when narration did not run.
	it('renders null when narration did not run', () => {
		expect(combinedUnnarratedArtifact.narration).toBeNull();

		const { container } = render(<Advisories advisories={[]} />);

		expect(container.firstChild).toBeNull();
	});

	it('renders an h2 naming the section, not the route h1', () => {
		render(<Advisories advisories={[{ text: 'Test advisory.' }]} />);

		const heading = screen.getByRole('heading', { level: 2 });
		expect(heading.textContent).not.toBe('');
	});

	// The definition of done requires the label say, in plain words, that
	// nothing derived these—a reader who mistakes this for a cited Task has
	// been told something the system cannot stand behind.
	it('states in words that no rule produced these', () => {
		render(<Advisories advisories={[{ text: 'Test advisory.' }]} />);

		expect(screen.getByText(/no rule produced these/i)).toBeDefined();
	});

	it('renders no source badge and no details element', () => {
		const { container } = render(<Advisories advisories={[{ text: 'Test advisory.' }]} />);

		expect(container.querySelector('details')).toBeNull();
		expect(container.querySelector('summary')).toBeNull();
		// SourceBadge always renders through shadcn's Badge, which is a div
		// carrying `rounded-full`; nothing else in this component's markup uses
		// that class, so its absence stands in for "SourceBadge was not used."
		expect(container.querySelector('.rounded-full')).toBeNull();
	});

	it('hides the decorative icon from assistive tech', () => {
		const { container } = render(<Advisories advisories={[{ text: 'Test advisory.' }]} />);

		const icon = container.querySelector('svg');
		expect(icon?.getAttribute('aria-hidden')).toBe('true');
	});

	it('renders every advisory in a multi-item list', () => {
		render(
			<Advisories
				advisories={[
					{ text: 'First advisory.' },
					{ text: 'Second advisory.' },
				]}
			/>,
		);

		expect(screen.getByText('First advisory.')).toBeDefined();
		expect(screen.getByText('Second advisory.')).toBeDefined();
	});
});
