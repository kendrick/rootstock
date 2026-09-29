import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NARRATION_FAILED_MESSAGE } from '@/artifact/artifact';
import { failingStatus, narratedArtifact, okStatus, unnarratedArtifact } from '@/artifact/fixtures';
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

		// One heading per rule; if any rule is silently dropped, this fails.
		for (const rule of seedRules) {
			expect(screen.getByRole('heading', { level: 3, name: `${rule.name}, ${rule.kind} rule` })).toBeDefined();
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
				expect(within(section).getByRole('heading', { level: 3, name: new RegExp(`^${rule.name},`, 'u') })).toBeDefined();
			}

			// Non-guards must not bleed into the Guards section.
			const nonGuardsInSeed = seedRules.filter(rule => rule.kind !== 'guard');
			for (const rule of nonGuardsInSeed) {
				expect(within(section).queryByRole('heading', { level: 3, name: new RegExp(`^${rule.name},`, 'u') })).toBeNull();
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

	// #64: every Rule in this yard shares one Region. The ticket head in the
	// shell prints it, so the page body adds neither a per-Rule nor a page copy.
	it('leaves the shared region to the ticket head', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		render(<RulesPage />);

		expect(screen.queryAllByText(/Zone 8b/)).toHaveLength(0);
	});

	// #64's cross-link criterion: the committed Plan already names every Rule
	// it used, and this proves the page actually reads that Plan rather than
	// rendering the seed Rules with no reference to it.
	it('files exactly the rules the committed Plan\'s Tasks and Guards name', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		render(<RulesPage />);

		// fall-pre-emergent and last-nitrogen both own a Task in narratedArtifact.
		const fired = screen.getByRole('region', { name: 'Fired this week' });
		expect(within(fired).getAllByRole('heading', { level: 3 }).map(heading => heading.querySelector('.sr-only')?.textContent)).toEqual([
			'Fall pre-emergent, window rule',
			'Last nitrogen of the year, window rule',
		]);
		// rain-expected deferred the fig watering; water-in-after-application
		// annotated the pre-emergent Task. Neither owns a Task itself. The fixture
		// Plan predates recorded verdicts, so only marked outcomes show and
		// nothing is called clear.
		const statusOf = (name: string): string => screen.getByRole('heading', { level: 3, name: new RegExp(`^${name},`, 'u') })
			.closest('li')
			?.querySelector('[data-rule-status]')
			?.textContent ?? '';
		expect(statusOf('Rain expected')).toContain('Deferring:Deep water the fig');
		expect(statusOf('Rain expected')).not.toContain('Let through');
		expect(statusOf('Water in after application')).toContain('Annotating:Apply fall pre-emergent to the front lawn');
	});

	// The index is built apart from the list, so it's checked against the bands
	// the list actually drew.
	it('indexes exactly the bands it draws, in order', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		render(<RulesPage />);

		const index = within(screen.getByRole('navigation', { name: 'On this page' })).getAllByRole('link');
		const bands = screen.getAllByRole('heading', { level: 2 });
		expect(index.map(link => link.textContent)).toEqual(bands.map(heading => heading.textContent));
		expect(index.map(link => link.getAttribute('href'))).toEqual(bands.map(heading => `#${heading.id}`));
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

// #77: the owner's one sign that the ticket went out in the Planner's own wording. It sits on the Rules page and nowhere the household reads first, and it says nothing on a narrated night or on a record from before the field existed.
describe('rules page, how the last run\'s Narration went', () => {
	const narrationLine = /Planner's own wording/;

	it('says so when the Narrator failed, and where to look', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: unnarratedArtifact, status: { ...okStatus, narration: { outcome: 'failed', error: NARRATION_FAILED_MESSAGE } } });

		render(<RulesPage />);

		const line = screen.getByText(narrationLine).textContent;
		// A failed run carries the outcome forward, so the line speaks of the run that made the ticket, never "the last run". The login check names the job's own CODEX_HOME, since an interactive shell's default can show a healthy login while the job's is expired.
		expect(line).toMatch(/Narrator ran into a problem on the run that made this week's ticket/);
		expect(line).not.toMatch(/last run/);
		expect(line).toMatch(/codex login status.*job's own.*CODEX_HOME/s);
	});

	it('says so when Narration is switched off, naming the switch', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: unnarratedArtifact, status: { ...okStatus, narration: { outcome: 'off', error: null } } });

		render(<RulesPage />);

		const line = screen.getByText(narrationLine).textContent;
		expect(line).toContain('ROOTSTOCK_NARRATION');
		expect(line).toMatch(/on the run that made this week's ticket/);
	});

	it('says nothing when Narration ran, or on a record that predates the field', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: { ...okStatus, narration: { outcome: 'ran', error: null } } });
		const { unmount } = render(<RulesPage />);
		expect(screen.queryByText(narrationLine)).toBeNull();
		unmount();

		// The shape of the committed data/status.json today, with no narration key at all, so this also exercises the fill ArtifactGate's parse does.
		const { narration: _narration, ...predatesNarration } = okStatus;
		vi.mocked(loadArtifact).mockReturnValue({ artifact: unnarratedArtifact, status: predatesNarration });
		render(<RulesPage />);
		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rules');
		expect(screen.queryByText(narrationLine)).toBeNull();
	});
});
