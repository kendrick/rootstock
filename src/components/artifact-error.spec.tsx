import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ArtifactError } from './artifact-error';

// This is a real sentence from parse.ts. The component's whole job is carrying
// that text to the page intact, and a shortened fake would not catch a render
// that truncates or summarises it.
const FAILURE = 'artifact: generatedAt Invalid ISO datetime, but received "yesterday".';

describe('artifactError', () => {
	it('announces itself as an alert', () => {
		render(<ArtifactError message={FAILURE} />);

		expect(screen.getByRole('alert')).toBeDefined();
	});

	// The sentence names the failing path and the value that arrived, which is
	// how a reader tells a hand-edit from a bad generation run. Paraphrasing it
	// or dropping the tail would take that away.
	it('renders the failure sentence verbatim', () => {
		render(<ArtifactError message={FAILURE} />);

		expect(screen.getByRole('alert').textContent).toContain(FAILURE);
	});

	it('gives the page its heading', () => {
		render(<ArtifactError message={FAILURE} />);

		expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
	});

	// The theme's --destructive is red-900, which fails contrast as text on the
	// zinc-950 page. This pins the marker to the filled-badge treatment so a
	// later tidy-up cannot turn the sentence red and unreadable.
	it('does not paint the failure sentence in the destructive colour', () => {
		render(<ArtifactError message={FAILURE} />);

		const sentence = screen.getByText(FAILURE);

		expect(sentence.getAttribute('class')).not.toContain('text-destructive');
	});

	it('tells the reader where to look', () => {
		render(<ArtifactError message={FAILURE} />);

		expect(screen.getByRole('alert').textContent).toContain('data/artifact.json');
	});
});

describe('artifactError, for the household', () => {
	it('gives the page its heading and one step the reader can take', () => {
		render(<ArtifactError message={FAILURE} audience="household" />);

		const alert = screen.getByRole('alert');
		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('This list couldn’t be put together today');
		expect(alert.textContent).toBe('This list couldn’t be put together todayAsk whoever gave it to you.');
	});
});
