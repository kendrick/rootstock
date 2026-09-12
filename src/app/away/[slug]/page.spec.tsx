import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadArtifact } from '@/artifact/load';
import { awayArtifact, awayStatus, delegableNarratedTaskId } from '@/components/away/fixtures';
import AwayPage, { dynamicParams, generateStaticParams } from './page';

// The loader is the seam, the same one src/app/page.spec.tsx uses. What the
// card does with what comes through it is away-card.spec.tsx's job; this file
// only proves the route hands both values over.
vi.mock('@/artifact/load', () => ({ loadArtifact: vi.fn() }));

const SLUG_VARIABLE = 'ROOTSTOCK_AWAY_SLUG';

/**
 * No fixture and no part of the shell renders this string, so finding it in the
 * markup means the route leaked its slug rather than that some ordinary word
 * happened to match.
 */
const DISTINCTIVE_SLUG = 'spec-only-marker-xyzzy';

// Twelve hours past the fixture's generatedAt, inside the fresh band. The page
// passes no `now`, so the banner reads the real clock, and left alone these
// renders would drift into a different band depending on the day they run.
const FRESH_INSTANT = new Date(Date.parse(awayArtifact.generatedAt) + 12 * 60 * 60 * 1000);

const NARRATED_TEXT = awayArtifact.narration?.tasks.find(entry => entry.taskId === delegableNarratedTaskId)?.text ?? '';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(FRESH_INSTANT);
	vi.mocked(loadArtifact).mockReturnValue({ artifact: awayArtifact, status: awayStatus });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.mocked(loadArtifact).mockReset();
});

describe('generateStaticParams', () => {
	it('builds the one route the variable names', () => {
		vi.stubEnv(SLUG_VARIABLE, DISTINCTIVE_SLUG);

		expect(generateStaticParams()).toEqual([{ slug: DISTINCTIVE_SLUG }]);
	});

	// Naming the variable is the whole job of the message. ADR 0004 asks the
	// build to say which one is missing rather than default to somewhere
	// plausible, and whoever hits this is usually on a machine that has never
	// had the value.
	it('fails by name when the variable is unset', () => {
		vi.stubEnv(SLUG_VARIABLE, undefined);

		expect(() => generateStaticParams()).toThrow(SLUG_VARIABLE);
	});

	// A shell that expands an unset variable hands the build a blank string, not
	// an absent one. Both are the same missing value.
	it('fails by name when the variable is blank', () => {
		vi.stubEnv(SLUG_VARIABLE, '   ');

		expect(() => generateStaticParams()).toThrow(SLUG_VARIABLE);
	});
});

// Nothing else in the suite would notice this flipping to true, and the cost of
// it flipping is that every guessed slug renders the card instead of 404ing,
// which leaves the secret slug protecting nothing.
describe('dynamicParams', () => {
	it('is false, so an unknown slug is a 404 and not a build-on-demand', () => {
		expect(dynamicParams).toBe(false);
	});
});

describe('away page', () => {
	it('renders the card from the loaded Artifact', () => {
		vi.stubEnv(SLUG_VARIABLE, DISTINCTIVE_SLUG);

		render(<AwayPage />);

		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Yard tasks this week');
		expect(screen.getByText(NARRATED_TEXT)).toBeDefined();
	});

	// The variable is not NEXT_PUBLIC_, and this is what that buys. A slug in
	// the page a visitor already has is harmless on its own, but the moment it
	// is in the markup it is in the bundle, on every route, for everyone.
	it('renders the slug nowhere', () => {
		vi.stubEnv(SLUG_VARIABLE, DISTINCTIVE_SLUG);

		const { container } = render(<AwayPage />);

		expect(container.textContent).not.toContain(DISTINCTIVE_SLUG);
		expect(container.innerHTML).not.toContain(DISTINCTIVE_SLUG);
	});
});
