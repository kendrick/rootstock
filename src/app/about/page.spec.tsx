import type { Artifact } from '@/artifact/artifact';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { approachingArtifact, deferredTaskId, narratedArtifact, okStatus } from '@/artifact/fixtures';
import { loadArtifact } from '@/artifact/load';
import AboutPage from './page';

// The loader is the seam, as on the other routes: swapping it is the only way
// to put a bad status record or an empty Plan in front of the page.
vi.mock('@/artifact/load', () => ({ loadArtifact: vi.fn() }));

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-09-11T12:00:00Z'));
});

afterEach(() => {
	vi.useRealTimers();
	vi.mocked(loadArtifact).mockReset();
});

const SPECIMEN_INTRO = /Here is one real Task from the current ticket/u;
const UNREADABLE = /The current ticket couldn.t be read/u;
const READOUT_CAPTION = /The line under each step is what that step did on the run that made the current ticket/u;

function withTasks(artifact: Artifact, keep: (id: string) => boolean): Artifact {
	return { ...artifact, plan: { ...artifact.plan, tasks: artifact.plan.tasks.filter(task => keep(task.id)) } };
}

describe('about page', () => {
	it('shows no Task from the ticket when the status record will not parse', () => {
		// Every other route sends both records through ArtifactGate, which shows no
		// Task when either is bad. A specimen beside an unreadable status would hide
		// a failed run behind a banner that silently never rendered.
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: { ok: 'maybe' } });

		render(<AboutPage />);

		expect(screen.getByText(UNREADABLE)).toBeDefined();
		expect(screen.queryByText(SPECIMEN_INTRO)).toBeNull();
	});

	it('puts what each step did on the ticket\'s run under that step', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });

		render(<AboutPage />);

		expect(screen.getByText(READOUT_CAPTION)).toBeDefined();
		const steps = screen.getAllByRole('listitem').filter(item => /^0[1-6]/u.test(item.textContent));
		expect(steps.map(step => step.querySelector('.font-mono')?.textContent)).toEqual([
			'32 days, Aug 13 – Sep 13 / 30 observed, 2 forecast / soil temperature at 6 cm',
			'9 Rules held / 3 Tasks from 3 Rules, for 2 Plants',
			'Rain expected: deferred 1 / Water in after application: annotated 1',
			'Narrator wrote 2 of 3 Task sentences / 1 Advisory',
			'Generated Fri Sep 11, 11:04 UTC',
			'Last run Fri Sep 11, 11:04 UTC: published / 0 failures in a row',
		]);
	});

	it('prints no run figures when the status record will not parse', () => {
		// The figures would be the one part of the page still vouching for a run
		// the site can't say anything true about.
		vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: { ok: 'maybe' } });

		render(<AboutPage />);

		expect(screen.queryByText(READOUT_CAPTION)).toBeNull();
		expect(screen.queryByText(/^Generated /u)).toBeNull();
	});

	it('calls a Plan with no Tasks a quiet week, not an unreadable ticket', () => {
		const empty: Artifact = {
			...withTasks(narratedArtifact, () => false),
			narration: { summary: 'A quiet week.', tasks: [], advisories: [] },
		};
		vi.mocked(loadArtifact).mockReturnValue({ artifact: empty, status: okStatus });

		render(<AboutPage />);

		expect(screen.getByText(/The current ticket has no Tasks/u)).toBeDefined();
		expect(screen.queryByText(UNREADABLE)).toBeNull();
		expect(screen.getByText('9 Rules held / No Tasks written')).toBeDefined();
	});

	it('does not say a narrated ticket went out without the Narrator', () => {
		// validateNarration lets the Narrator skip every Task, so a narrated ticket
		// can offer nothing to compare while its summary still shows on This Week.
		const skippedAll: Artifact = {
			...narratedArtifact,
			narration: { summary: 'A quiet week.', tasks: [], advisories: [] },
		};
		vi.mocked(loadArtifact).mockReturnValue({ artifact: skippedAll, status: okStatus });

		render(<AboutPage />);

		expect(screen.queryByText(/went out without the Narrator/u)).toBeNull();
		expect(screen.getByText(/none of its sentences differs from the Planner.s/u)).toBeDefined();
	});

	it('offers no comparison when the Narrator returned the line the row already prints', () => {
		// With the Narrator off, this row prints "never recorded" under the Rule's
		// name. A Narrator answering with that same clause changed nothing on This
		// Week, so there's no second wording to set beside it.
		const [fired] = narratedArtifact.plan.tasks;
		if (fired === undefined) {
			throw new Error('narratedArtifact has no Task to reshape');
		}
		const echoed: Artifact = {
			...narratedArtifact,
			plan: {
				...narratedArtifact.plan,
				tasks: [{ ...fired, id: 'esperanza-feeding@esperanza-1', ruleId: 'esperanza-feeding', plantId: 'esperanza-1', citation: { kind: 'cadence', lastOccurrenceId: null, elapsedDays: null }, annotations: [], guardChecks: null, title: 'Feed the Esperanza (Esperanza), never recorded' }],
			},
			narration: { summary: 'A quiet week.', tasks: [{ taskId: 'esperanza-feeding@esperanza-1', text: 'never recorded' }], advisories: [] },
		};
		vi.mocked(loadArtifact).mockReturnValue({ artifact: echoed, status: okStatus });

		render(<AboutPage />);

		// The specimen renders, so the Artifact parsed and the absence below is the
		// comparison's own, not the unreadable-ticket fallback.
		expect(screen.getByText(SPECIMEN_INTRO)).toBeDefined();
		expect(screen.queryByRole('heading', { name: 'The same Task, written two ways' })).toBeNull();
		expect(screen.getByText(/none of its sentences differs from the Planner.s/u)).toBeDefined();
	});

	it('draws an approaching specimen the way This Week does, with no box to sign off', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: approachingArtifact, status: okStatus });

		const { container } = render(<AboutPage />);

		// The cell This Week prints, and the note that names it.
		expect(screen.getAllByText('Not yet')).toHaveLength(2);
		expect(screen.getByText(/^About [A-Z][a-z]{2} \d+$/u)).toBeDefined();
		expect(screen.queryByText(/Tap the box on This Week/u)).toBeNull();
		expect(container.querySelector('span.size-8.border-2')).toBeNull();
	});

	it('draws a held specimen under the HELD mark This Week prints', () => {
		vi.mocked(loadArtifact).mockReturnValue({ artifact: withTasks(narratedArtifact, id => id === deferredTaskId), status: okStatus });

		render(<AboutPage />);

		expect(screen.getByText('Held')).toBeDefined();
		expect(screen.getByText(/A Guard is holding this Task back/u)).toBeDefined();
	});
});
