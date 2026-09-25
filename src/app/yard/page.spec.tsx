import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { failingStatus, narratedArtifact, okStatus } from '@/artifact/fixtures';
import { loadArtifact } from '@/artifact/load';
import { seedPlants } from '@/seed';
import YardPage from './page';

// The loader is the seam. Swapping it is the only way to put a malformed
// Artifact in front of the page, and a hand-edit to data/artifact.json between
// generation runs is exactly the case the gate exists for.
vi.mock('@/artifact/load', () => ({ loadArtifact: vi.fn() }));

// Far enough past the fixture's generatedAt to land in the stale band, so the
// banner renders the paragraph that carries the timestamp. Left to the real
// clock, the assertions below would pass or fail depending on the hour the
// suite happens to run.
const STALE_INSTANT = new Date('2026-09-13T02:00:00Z');

const firstSeedPlant = seedPlants[0]!;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(STALE_INSTANT);
});

afterEach(() => {
	vi.useRealTimers();
	vi.mocked(loadArtifact).mockReset();
});

describe('yard page', () => {
	// `Yard` verbatim, because shell/nav.tsx labels the route with that word and
	// tests/integration/ drives the built export by heading text. A friendlier
	// wording here would pass every unit test and break the end-to-end run.
	it('heads the route Yard and nothing else', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		render(<YardPage />);

		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Yard');
	});

	// The seed is the inventory this route renders, so the assertion is that a
	// real seed Plant reached the page, not that some list exists.
	it('renders the seed inventory under the heading', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		render(<YardPage />);

		const list = screen.getByRole('list', { name: 'Plants' });

		// Plant rows, counted by their buttons: the week view adds a "Nothing this
		// week" rule to the list, which is an item but not a Plant.
		expect(within(list).getAllByRole('button')).toHaveLength(seedPlants.length);
		// Scoped to the list because a sited Plant also has a pin on the photo
		// carrying the same name.
		expect(within(list).getByRole('button', {
			name: accessibleName => accessibleName.startsWith(firstSeedPlant.name),
		})).toBeDefined();
	});

	// Both halves of what the loader returned have to arrive at the banner: the
	// Artifact supplies the instant on the <time> element, the status record
	// supplies the failure count.
	it('passes both loaded values through the gate to the banner', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: failingStatus });

		render(<YardPage />);

		const banner = screen.getByRole('status');

		expect(banner.querySelector('time')?.getAttribute('datetime')).toBe(narratedArtifact.generatedAt);
		expect(banner.textContent).toContain(`The last ${failingStatus.consecutiveFailures} runs failed`);
	});

	// Nothing below the gate may render on a bad parse: a Plant beside an error
	// is a yard nobody validated, and a staleness line would suggest the rest of
	// the page is merely running late.
	it('renders none of its own content when the gate fails', () => {
		vi.mocked(loadArtifact).mockReturnValue({
			artifact: { ...narratedArtifact, generatedAt: 'yesterday' },
			status: okStatus,
		});

		render(<YardPage />);

		expect(screen.getByRole('alert').textContent).toContain('generatedAt');
		// The error state owns the page's only h1, so the check is that the route's
		// own heading is gone rather than that no heading rendered.
		expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe('Yard');
		expect(screen.queryByRole('list', { name: 'Plants' })).toBeNull();
	});

	// `output: 'export'` prerenders this route in Node at build time. A timestamp
	// in that markup would be the build machine's instant, and the browser would
	// contradict it on hydration, so the prerender has to carry no clock reading
	// at all. renderToStaticMarkup stands in for that prerender, since effects
	// never fire there, which is also what keeps the sheet's store read, and
	// IndexedDB with it, out of a Node build.
	it('keeps every timestamp out of the prerendered markup', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: failingStatus });

		const markup = renderToStaticMarkup(<YardPage />);

		expect(markup).toContain('Yard');
		expect(markup).toContain(firstSeedPlant.name);
		expect(markup).not.toContain('<time');
		expect(markup).not.toContain(narratedArtifact.generatedAt);
		// The banner has to be absent whole, not merely missing its timestamp.
		// `generatedAt` is a fixed instant and the wall clock keeps moving, so the
		// band this fixture lands in changes over time—and the failure sentence
		// is the one part that renders in every band.
		expect(markup).not.toContain('runs failed');
		expect(markup).not.toContain('role="status"');
	});
});
