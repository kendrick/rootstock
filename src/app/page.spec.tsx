import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { failingStatus, narratedArtifact, okStatus } from '@/artifact/fixtures';
import { loadArtifact } from '@/artifact/load';
import ThisWeekPage from './page';

// The loader is the seam. Swapping it is the only way to put a malformed
// Artifact in front of the page, and a hand-edit to data/artifact.json between
// generation runs is exactly the case the gate exists for.
vi.mock('@/artifact/load', () => ({ loadArtifact: vi.fn() }));

const PLACEHOLDER = /The Plan for this week goes here/;

// Far enough past the fixture's generatedAt to land in the stale band, so the
// banner renders the paragraph that carries the timestamp. Left to the real
// clock, the assertions below would pass or fail depending on the hour the
// suite happens to run.
const STALE_INSTANT = new Date('2026-09-13T02:00:00Z');

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(STALE_INSTANT);
});

afterEach(() => {
	vi.useRealTimers();
	vi.mocked(loadArtifact).mockReset();
});

describe('this week page', () => {
	it('renders its own heading and placeholder once both values validate', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		render(<ThisWeekPage />);

		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('This Week');
		expect(screen.getByText(PLACEHOLDER)).toBeDefined();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	// Both halves of what the loader returned have to arrive at the banner: the
	// Artifact supplies the instant on the <time> element, the status record
	// supplies the failure count. Asserting on the placeholder alone would pass
	// just as well with the page handing the gate two literals of its own.
	it('passes both loaded values through the gate to the banner', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: failingStatus });

		render(<ThisWeekPage />);

		const banner = screen.getByRole('status');

		expect(banner.querySelector('time')?.getAttribute('datetime')).toBe(narratedArtifact.generatedAt);
		expect(banner.textContent).toContain(`The last ${failingStatus.consecutiveFailures} runs failed`);
	});

	// The gate's own spec proves the render prop is never called. This one proves
	// the route puts nothing beside the error: no heading, and no staleness claim
	// to suggest the rest of the page is merely running late.
	it('renders none of its own content when the gate fails', () => {
		vi.mocked(loadArtifact).mockReturnValue({
			artifact: { ...narratedArtifact, generatedAt: 'yesterday' },
			status: okStatus,
		});

		render(<ThisWeekPage />);

		expect(screen.getByRole('alert').textContent).toContain('generatedAt');
		expect(screen.queryByText(PLACEHOLDER)).toBeNull();
		expect(screen.queryByRole('status')).toBeNull();
	});

	// `output: 'export'` prerenders this route in Node at build time. A timestamp
	// in that markup would be the build machine's instant, and the browser would
	// contradict it on hydration, so the prerender has to carry no clock reading
	// at all. renderToStaticMarkup stands in for that prerender, since effects
	// never fire there.
	it('keeps every timestamp out of the prerendered markup', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: failingStatus });

		const markup = renderToStaticMarkup(<ThisWeekPage />);

		expect(markup).toContain('This Week');
		expect(markup).not.toContain('<time');
		expect(markup).not.toContain(narratedArtifact.generatedAt);
		// The banner has to be absent whole, not merely missing its timestamp.
		// `generatedAt` is a fixed instant and the wall clock keeps moving, so the
		// band this fixture lands in changes over time — and the failure sentence
		// is the one part that renders in every band. Asserting on it keeps this
		// test's teeth from depending on what day it runs.
		expect(markup).not.toContain('runs failed');
		expect(markup).not.toContain('role="status"');
	});
});
