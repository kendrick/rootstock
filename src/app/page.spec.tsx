import { act, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { failingStatus, narratedArtifact, okStatus } from '@/artifact/fixtures';
import { loadArtifact } from '@/artifact/load';
import ThisWeekPage from './page';
// The route passes no `store` prop, so `ThisWeek` falls back to
// `openBrowserStore` and reaches for `globalThis.indexedDB`, which jsdom does
// not ship. Installing the fake here lets these tests exercise the default the
// deployed page runs on, rather than a seam invented for them.
import 'fake-indexeddb/auto';

// The loader is the seam. Swapping it is the only way to put a malformed
// Artifact in front of the page, and a hand-edit to data/artifact.json between
// generation runs is exactly the case the gate exists for.
vi.mock('@/artifact/load', () => ({ loadArtifact: vi.fn() }));

/**
 * The model's line for the fixture's first Task, read off the fixture rather
 * than retyped, so an edited narration fails here by name instead of leaving
 * this spec asserting a sentence nobody renders.
 */
function narratedLine(): string {
	const line = narratedArtifact.narration?.tasks[0]?.text;
	if (line === undefined) {
		throw new Error('narratedArtifact no longer narrates a Task: this spec has nothing to look for');
	}
	return line;
}

const PLAN_LINE = narratedLine();

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

/**
 * Renders the route and lets the Occurrence load settle.
 *
 * `ThisWeek` reads its checked state from the store in an effect, so a bare
 * render leaves a state update in flight past the end of the test. Flushing it
 * here means every assertion below reads a settled page.
 */
async function renderPage(): Promise<void> {
	await act(async () => {
		render(<ThisWeekPage />);
	});
}

describe('this week page', () => {
	it('renders its own heading and the Plan once both values validate', async () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		await renderPage();

		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('This Week');
		expect(screen.getByText(PLAN_LINE)).toBeDefined();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	// Both halves of what the loader returned have to arrive at the banner: the
	// Artifact supplies the instant on the <time> element, the status record
	// supplies the failure count. Asserting on the Plan alone would pass just as
	// well with the page handing the gate two literals of its own.
	it('passes both loaded values through the gate to the banner', async () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: failingStatus });

		await renderPage();

		const banner = screen.getByRole('status');

		expect(banner.querySelector('time')?.getAttribute('datetime')).toBe(narratedArtifact.generatedAt);
		expect(banner.textContent).toContain(`The last ${failingStatus.consecutiveFailures} runs failed`);
	});

	// The gate's own spec proves the render prop is never called. This one proves
	// the route puts nothing beside the error: no heading, no Task, and no
	// staleness claim to suggest the rest of the page is merely running late.
	it('renders none of its own content when the gate fails', async () => {
		vi.mocked(loadArtifact).mockReturnValue({
			artifact: { ...narratedArtifact, generatedAt: 'yesterday' },
			status: okStatus,
		});

		await renderPage();

		expect(screen.getByRole('alert').textContent).toContain('generatedAt');
		expect(screen.queryByText(PLAN_LINE)).toBeNull();
		expect(screen.queryByRole('status')).toBeNull();
	});

	/*
	 * #50 measured this route at 1440x900, found `scrollHeight` of exactly 900,
	 * and found two strings ahead of the first task: `<h1>This Week` and
	 * `<h2>Ready now`. Neither said one yard, neither said the region, and
	 * neither mentioned a rule or a reading. The brief sentence the critique
	 * graded against asks that the page say what it is before it says what to
	 * do, and this is the half of that a unit test can hold: the copy exists,
	 * it makes the claim, and it comes first.
	 */
	it('says what the page is before it says what to do', async () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		await renderPage();

		const purpose = screen.getByText(/one yard/i);
		expect(purpose.textContent).toMatch(/rule/i);
		expect(purpose.textContent).toMatch(/evidence/i);

		const firstTask = document.querySelector('li');
		expect(firstTask).not.toBeNull();
		expect(purpose.compareDocumentPosition(firstTask as Node) & Node.DOCUMENT_POSITION_FOLLOWING)
			.toBeTruthy();
	});

	// Above the fold means in the first paint, and `output: 'export'` means the
	// first paint is the prerendered HTML. Copy that arrived only on hydration
	// would fail the brief for anyone the script never reaches.
	it('ships the purpose copy in the prerendered markup', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		const markup = renderToStaticMarkup(<ThisWeekPage />);

		expect(markup).toMatch(/ for one yard\. /);
		expect(markup).toContain('Southwest Fort Worth, Texas');
	});

	// `output: 'export'` prerenders this route in Node at build time. A clock
	// reading in that markup would be the build machine's instant, and the
	// browser would contradict it on hydration, so the prerender has to carry no
	// clock reading at all. renderToStaticMarkup stands in for that prerender,
	// since effects never fire there.
	it('keeps every clock reading out of the prerendered markup', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: failingStatus });

		const markup = renderToStaticMarkup(<ThisWeekPage />);

		expect(markup).toContain('This Week');
		// The banner has to be absent whole, not merely missing its timestamp.
		// `generatedAt` is a fixed instant and the wall clock keeps moving, so the
		// band this fixture lands in changes over time—and the failure sentence
		// is the one part that renders in every band. Asserting on it keeps this
		// test's teeth from depending on what day it runs.
		expect(markup).not.toContain(narratedArtifact.generatedAt);
		expect(markup).not.toContain('runs failed');
		expect(markup).not.toContain('role="status"');
		// Nothing here forbids `<time>` itself, and that is deliberate.
		// `CitationDisclosure` dates its evidence with one, and those dates are
		// calendar days the Artifact already carries: settled at generation,
		// identical in Node and in the browser, so hydration has nothing to
		// contradict. The property this test protects is narrower. No reading of
		// the clock the build ran on may reach this markup.
		expect(markup).toContain(PLAN_LINE);
	});
});
