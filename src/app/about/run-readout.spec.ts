import type { Artifact } from '@/artifact/artifact';
import type { DailyAggregate } from '@/planner/plan';
import type { Task } from '@/planner/task';
import { describe, expect, it } from 'vitest';
import { approachingArtifact, failingStatus, narratedArtifact, okStatus, unnarratedArtifact } from '@/artifact/fixtures';
import { seedPlannedFrom } from '@/artifact/planned-from';
import { seedRules } from '@/seed';
import { runReadout } from './run-readout';

// Every expected string below is written out by hand from the fixture's own
// numbers, so a readout that counts the wrong thing fails instead of agreeing
// with itself.
const context = { rules: seedRules, seedFingerprint: seedPlannedFrom };

/** The status record the run that made `narratedArtifact` would have written. */
const publishedStatus = { ...okStatus, attemptedAt: narratedArtifact.generatedAt, artifactGeneratedAt: narratedArtifact.generatedAt };

function withTasks(artifact: Artifact, tasks: Task[]): Artifact {
	return { ...artifact, plan: { ...artifact.plan, tasks } };
}

function firstTask(artifact: Artifact): Task {
	const [task] = artifact.plan.tasks;
	if (task === undefined) {
		throw new Error('fixture has no Task');
	}
	return task;
}

function rainChance(date: string, basis: 'observed' | 'forecast'): DailyAggregate {
	return { date, variable: 'precipitation-probability', depthCm: null, aggregate: 'max', value: 20, unit: 'percent', basis, provenance: 'modeled', source: 'open-meteo' };
}

describe('runReadout', () => {
	it('reads the September run the way a grader would off the file', () => {
		expect(runReadout(narratedArtifact, publishedStatus, context)).toEqual({
			weather: '32 days, Aug 13 – Sep 13 / 30 observed, 2 forecast / soil temperature at 6 cm',
			plan: '9 Rules held / 3 Tasks from 3 Rules, for 2 Plants',
			// In the order the Plan's Tasks carry them: the pre-emergent Task's
			// Annotation comes before the fig's Deferral.
			guards: 'Water in after application: annotated 1 / Rain expected: deferred 1',
			narration: 'Narrator wrote 2 of 3 Task sentences / 1 Advisory',
			publish: 'Generated Fri Sep 11, 11:04 UTC',
			age: 'Last run Fri Sep 11, 11:04 UTC: published / 0 failures in a row',
		});
	});

	it('counts forecast days apart from observed ones', () => {
		expect(runReadout(approachingArtifact, okStatus, context).weather)
			.toBe('34 days, Feb 1 – Mar 6 / 30 observed, 4 forecast / soil temperature at 6 cm');
	});

	it('names every variable once, however many days carry it', () => {
		const withRain: Artifact = {
			...narratedArtifact,
			plan: { ...narratedArtifact.plan, window: [...narratedArtifact.plan.window, rainChance('2026-09-11', 'observed'), rainChance('2026-09-12', 'forecast')] },
		};

		expect(runReadout(withRain, okStatus, context).weather)
			.toBe('32 days, Aug 13 – Sep 13 / 30 observed, 2 forecast / soil temperature at 6 cm, rain chance');
	});

	it('says so when the window holds no readings', () => {
		const empty: Artifact = { ...narratedArtifact, plan: { ...narratedArtifact.plan, window: [] } };

		expect(runReadout(empty, okStatus, context).weather).toBe('No readings in the Plan\'s window');
	});

	it('leaves out the Rule count when the Plan came from other records', () => {
		// ADR 0007: the build's seed isn't the one the run read, so its count
		// would be a figure the Artifact can't back.
		expect(runReadout({ ...narratedArtifact, plannedFrom: '0123456789abcdef' }, okStatus, context).plan)
			.toBe('3 Tasks from 3 Rules, for 2 Plants');
		expect(runReadout({ ...narratedArtifact, plannedFrom: null }, okStatus, context).plan)
			.toBe('3 Tasks from 3 Rules, for 2 Plants');
	});

	it('says no Tasks were written on a quiet week', () => {
		const quiet: Artifact = { ...withTasks(narratedArtifact, []), narration: { summary: 'A quiet week.', tasks: [], advisories: [] } };
		const readout = runReadout(quiet, okStatus, context);

		expect(readout.plan).toBe('9 Rules held / No Tasks written');
		expect(readout.guards).toBe('No Tasks for a Guard to check');
		expect(readout.narration).toBe('Narrator wrote the summary only / 0 Advisories');
	});

	it('reports a Guard that looked and let the work through, once verdicts are recorded', () => {
		const task = firstTask(unnarratedArtifact);
		const checked = withTasks(unnarratedArtifact, [
			{ ...task, annotations: [], guardChecks: [{ guardId: 'rain-expected', verdict: 'unmet' }] },
			{ ...task, id: 'last-nitrogen@front-lawn', ruleId: 'last-nitrogen', annotations: [], guardChecks: [] },
		]);

		expect(runReadout(checked, okStatus, context).guards).toBe('Rain expected: let through 1');
	});

	it('tells a recorded pass that reached nothing from an older one that left no mark', () => {
		const task = firstTask(unnarratedArtifact);
		const unmarked = { ...task, annotations: [] };

		expect(runReadout(withTasks(unnarratedArtifact, [{ ...unmarked, guardChecks: [] }]), okStatus, context).guards)
			.toBe('No Guard reached a Task');
		expect(runReadout(withTasks(unnarratedArtifact, [{ ...unmarked, guardChecks: null }]), okStatus, context).guards)
			.toBe('No Guard left a mark');
	});

	it('names a Guard by the id the Task stored when the Plan came from other records', () => {
		// The build's Rules may have renamed or dropped a Guard since the run, so
		// its name is only trusted when the fingerprint says the run read it.
		expect(runReadout({ ...narratedArtifact, plannedFrom: '0123456789abcdef' }, okStatus, context).guards)
			.toBe('water-in-after-application: annotated 1 / rain-expected: deferred 1');
	});

	it('reports a Guard the build no longer holds from what the Task stored', () => {
		const task = firstTask(unnarratedArtifact);
		const retired = withTasks({ ...unnarratedArtifact, plannedFrom: null }, [
			{ ...task, annotations: [{ guardId: 'frost-watch', text: 'Cover it tonight.' }], guardChecks: [{ guardId: 'frost-watch', verdict: 'met' }] },
		]);

		expect(runReadout(retired, okStatus, context).guards).toBe('frost-watch: annotated 1');
	});

	it('counts a Task the Narration names twice once', () => {
		const task = firstTask(narratedArtifact);
		const repeated: Artifact = {
			...withTasks(narratedArtifact, [task]),
			narration: { summary: 'A quiet week.', tasks: [{ taskId: task.id, text: 'Once.' }, { taskId: task.id, text: 'Twice.' }], advisories: [] },
		};

		expect(runReadout(repeated, okStatus, context).narration).toBe('Narrator wrote 1 of 1 Task sentences / 0 Advisories');
	});

	it('says the ticket carries the Planner\'s wording when the run had no Narration', () => {
		expect(runReadout(unnarratedArtifact, okStatus, context).narration).toBe('No Narration / Planner\'s wording on every Task');
	});

	it('calls a failed attempt after the ticket the latest attempt, and dates the ticket apart', () => {
		// failingStatus tried on Sep 14 and failed; the ticket is still Sep 11's.
		// A line reading "Last run Sep 14" under "the run that made the ticket"
		// would pin a failure on a run that published.
		expect(runReadout(narratedArtifact, failingStatus, context).age)
			.toBe('Latest attempt Mon Sep 14, 11:03 UTC: failed / 3 failures in a row / ticket from Fri Sep 11, 11:04 UTC');
		expect(runReadout(narratedArtifact, { ...failingStatus, consecutiveFailures: 1 }, context).age)
			.toBe('Latest attempt Mon Sep 14, 11:03 UTC: failed / 1 failure in a row / ticket from Fri Sep 11, 11:04 UTC');
	});

	it('treats a published attempt as the ticket\'s run only when it names the ticket\'s generatedAt', () => {
		// okStatus records the unnarrated twin's generatedAt, two seconds after
		// the narrated one's, so it is not the run that made this ticket.
		expect(runReadout(narratedArtifact, okStatus, context).age)
			.toBe('Latest attempt Fri Sep 11, 11:04 UTC: published / 0 failures in a row / ticket from Fri Sep 11, 11:04 UTC');
		expect(runReadout(narratedArtifact, publishedStatus, context).age)
			.toBe('Last run Fri Sep 11, 11:04 UTC: published / 0 failures in a row');
	});
});
