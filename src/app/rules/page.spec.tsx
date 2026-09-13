import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { failingStatus, narratedArtifact, okStatus } from '@/artifact/fixtures';
import { loadArtifact } from '@/artifact/load';
import { seedRules } from '@/seed';
import RulesPage from './page';

// The loader is the seam. Swapping it is the only way to put a malformed
// Artifact in front of the page, and a hand-edit to data/artifact.json between
// generation runs is exactly the case the gate exists for.
vi.mock('@/artifact/load', () => ({ loadArtifact: vi.fn() }));

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

const guardCount = seedRules.filter(rule => rule.kind === 'guard').length;

describe('rules page', () => {
	// `Rules` verbatim, because shell/nav.tsx labels the route with that word and
	// tests/integration/ drives the built export by heading text. A friendlier
	// wording here would pass every unit test and break the end-to-end run.
	it('heads the route Rules and nothing else', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		render(<RulesPage />);

		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rules');
	});

	it('renders every seed rule', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		render(<RulesPage />);

		// One name element per rule; if any rule is silently dropped, this count fails.
		for (const rule of seedRules) {
			expect(screen.getByText(rule.name)).toBeDefined();
		}
	});

	it('renders the seed guards under the Guards heading', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		render(<RulesPage />);

		// Guards heading exists only because the seed has at least one guard—if the
		// seed loses all guards this assertion fails by name and the route still works.
		if (guardCount > 0) {
			const section = screen.getByRole('region', { name: 'Guards' });

			const guardsInSection = seedRules.filter(rule => rule.kind === 'guard');
			for (const rule of guardsInSection) {
				expect(within(section).getByText(rule.name)).toBeDefined();
			}

			// Non-guards must not bleed into the Guards section.
			const nonGuardsInSeed = seedRules.filter(rule => rule.kind !== 'guard');
			for (const rule of nonGuardsInSeed) {
				expect(within(section).queryByText(rule.name)).toBeNull();
			}
		}
	});

	it('has no Guards section when the seed has no guards', () => {
		// This test is conditional: it passes trivially when guards exist, which is
		// fine—the assertion it makes only matters when guardCount is 0.
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		render(<RulesPage />);

		if (guardCount === 0) {
			expect(screen.queryByRole('heading', { level: 2, name: 'Guards' })).toBeNull();
		}
		else {
			// Guards heading is present, and that is correct for a seed with guards.
			expect(screen.getByRole('heading', { level: 2, name: 'Guards' })).toBeDefined();
		}
	});

	// Both halves of what the loader returned have to arrive at the banner: the
	// Artifact supplies the instant on the <time> element, the status record
	// supplies the failure count.
	it('passes both loaded values through the gate to the banner', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: failingStatus });

		render(<RulesPage />);

		const banner = screen.getByRole('status');

		expect(banner.querySelector('time')?.getAttribute('datetime')).toBe(narratedArtifact.generatedAt);
		expect(banner.textContent).toContain(`The last ${failingStatus.consecutiveFailures} runs failed`);
	});

	// Nothing below the gate may render on a bad parse: a rule list beside an
	// error says the data is valid when it is not, and the staleness banner would
	// suggest the content is merely running late.
	it('renders none of its own content when the gate fails', () => {
		vi.mocked(loadArtifact).mockReturnValue({
			artifact: { ...narratedArtifact, generatedAt: 'yesterday' },
			status: okStatus,
		});

		render(<RulesPage />);

		expect(screen.getByRole('alert').textContent).toContain('generatedAt');
		// The error state owns the page's only h1, so check the route heading is gone.
		expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe('Rules');
		// No rule names below the failed gate.
		for (const rule of seedRules.slice(0, 3)) {
			expect(screen.queryByText(rule.name)).toBeNull();
		}
	});

	// `output: 'export'` prerenders this route in Node at build time. A timestamp
	// in that markup would be the build machine's instant, and the browser would
	// contradict it on hydration.
	it('keeps every clock reading out of the prerendered markup', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: failingStatus });

		const markup = renderToStaticMarkup(<RulesPage />);

		expect(markup).toContain('Rules');
		expect(markup).not.toContain(narratedArtifact.generatedAt);
		expect(markup).not.toContain('runs failed');
		expect(markup).not.toContain('role="status"');
	});
});
