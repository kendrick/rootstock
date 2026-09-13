import type { GenerationFailure } from './failure';
import type { GenerationResult, GenerationRunOptions } from './run';
import type { Artifact } from '@/artifact/artifact';
import type { Narration } from '@/artifact/narration';
import type { Rule } from '@/rules/rule';
import type { Observation } from '@/weather/observation';
import { describe, expect, it } from 'vitest';
import { PLAN_WINDOW_DAYS } from '@/planner/plan';
import { fakeObservations } from '@/weather/fake-adapter';
import {
	fixtureLocation,
	fixtureNow,
	fixtureObservations,
	fixturePlan,
	fixturePreviousStatus,
	fixtureSeed,
} from './fixtures';
import { fakeNarrator } from './narrator';
import { run } from './run';

/**
 * A Narration that names every Task the fixture Plan contains, built off
 * `fixturePlan` rather than hand-listing ids. A Rule added to the fixture would
 * otherwise leave the Narration citing a Plan that has moved on, and the run
 * would fall back to mechanical prose in tests that are about something else.
 */
const narration: Narration = {
	summary: 'A cool, wet week in the yard.',
	tasks: fixturePlan.tasks.map(task => ({ taskId: task.id, text: `Something about ${task.id}.` })),
	advisories: [],
};

/**
 * The whole of a run's inputs, faked. Every spec below starts here and
 * overrides the one thing it is about, so nothing in this file reaches the
 * network, a model, or the machine's clock.
 */
function options(overrides: Partial<GenerationRunOptions> = {}): GenerationRunOptions {
	return {
		fetchObservations: fakeObservations(fixtureObservations),
		narrator: fakeNarrator(narration),
		now: fixtureNow,
		location: fixtureLocation,
		seed: fixtureSeed,
		previousStatus: fixturePreviousStatus,
		...overrides,
	};
}

// The narrowing every real caller does, with the failing half turned into a
// readable message. A bare `result.artifact` would be a type error, and an
// assertion on `'artifact' in result` alone would leave a failed run reporting
// `undefined` instead of the stage that could not finish.
function artifactOf(result: GenerationResult): Artifact {
	if (!('artifact' in result)) {
		throw new Error(`expected an artifact, but the run failed at the ${result.failure.stage} stage: ${result.failure.message}`);
	}
	return result.artifact;
}

function failureOf(result: GenerationResult): GenerationFailure {
	if (!('failure' in result)) {
		throw new Error(`expected a failure, but the run published the artifact generated at ${result.artifact.generatedAt}`);
	}
	return result.failure;
}

function ruleNamed(id: string): Rule {
	const rule = fixtureSeed.rules.find(candidate => candidate.id === id);
	if (rule === undefined) {
		throw new Error(`generation run spec: the fixture rule set no longer contains '${id}'.`);
	}
	return rule;
}

function withRules(rules: Rule[]): Partial<GenerationRunOptions> {
	return { seed: { ...fixtureSeed, rules } };
}

describe('run', () => {
	it('publishes the plan the planner returned, stamped with the moment it was handed', async () => {
		const artifact = artifactOf(await run(options()));

		expect(artifact.version).toBe(1);
		expect(artifact.generatedAt).toBe(fixtureNow.toISOString());
		expect(artifact.plan).toEqual(fixturePlan);
		expect(artifact.narration).toEqual(narration);
		expect(artifact.narrated).toBe(true);
	});

	it('ships the window the planner evaluated, untrimmed and unsorted', async () => {
		// ADR 0003 puts the window on the Plan because only the run that produced
		// it knows which days its Rules read. Anything this function did to the
		// window on the way out would be a second opinion about that.
		const artifact = artifactOf(await run(options()));

		expect(artifact.plan.window).toEqual(fixturePlan.window);
		expect(artifact.plan.window.length).toBeGreaterThan(0);
	});

	it('plans for the local day `now` falls in, reading no clock of its own', async () => {
		const artifact = artifactOf(await run(options()));

		expect(artifact.plan.asOf).toBe('2026-09-11');
	});

	it('resolves the same instant into a different day under a different time zone', async () => {
		// 15:00 UTC is still the 11th in Chicago and already the 12th in Tokyo. The
		// run has no opinion of its own about which: `now` and the Location's zone
		// are the whole of what it knows about today.
		const artifact = artifactOf(await run(options({
			location: { ...fixtureLocation, timeZone: 'Asia/Tokyo' },
		})));

		expect(artifact.plan.asOf).toBe('2026-09-12');
	});

	it('leaves the task list untouched whether or not the narrator ran, which is ADR 0001\'s central claim', async () => {
		// Turning the model off has to change the prose and nothing else. This is
		// the property anyone can check by diffing two runs, and the reason the
		// Planner is a pure function the model never gets to edit.
		const narrated = artifactOf(await run(options()));
		const mechanical = artifactOf(await run(options({
			narrator: fakeNarrator(new Error('the model timed out')),
		})));

		expect(mechanical.plan).toEqual(narrated.plan);
		expect(narrated.narrated).toBe(true);
		expect(mechanical.narrated).toBe(false);
	});

	it('publishes without narration when the narrator throws', async () => {
		const result = await run(options({ narrator: fakeNarrator(new Error('the model timed out')) }));
		const artifact = artifactOf(result);

		expect(artifact.narration).toBeNull();
		expect(artifact.narrated).toBe(false);
		expect(result.status.ok).toBe(true);
	});

	it('leaves every task carrying the planner\'s own sentence when the model is off', async () => {
		// The mechanical title is what the Away Card renders on a night the model
		// could not be reached, and ADR 0001 calls it a real deliverable rather
		// than a placeholder. Checking only `narrated === false` would pass over
		// an Artifact whose Tasks went out with nothing to read on them.
		const artifact = artifactOf(await run(options({
			narrator: fakeNarrator(new Error('the model timed out')),
		})));

		expect(artifact.plan.tasks.length).toBeGreaterThan(0);
		for (const task of artifact.plan.tasks) {
			expect(task.title, `task '${task.id}' published with no prose to read`).not.toBe('');
		}
	});

	it('publishes prose carrying a quoted word before a colon', async () => {
		// The coordinate walk reads field names off the parsed Artifact rather
		// than out of its text, and this is why. `related` contains `lat`, and a
		// `"key":` pattern run over the serialized file would read the quoted word
		// as a field name and reject the night's run over a sentence.
		const quoting: Narration = {
			...narration,
			summary: 'The lawn and the fig are "related": both went in the same autumn.',
		};

		const artifact = artifactOf(await run(options({ narrator: fakeNarrator(quoting) })));

		expect(artifact.narrated).toBe(true);
	});

	it('falls back to mechanical prose when the narration names a task the plan does not contain', async () => {
		// A fabricated task id is the failure ADR 0001 trades the prompt-shaped
		// design to catch. The run drops the prose rather than publishing a
		// sentence about work the Planner never authored.
		const invented: Narration = {
			...narration,
			tasks: [{ taskId: 'overseed@back-lawn', text: 'Overseed the back lawn.' }],
		};

		const artifact = artifactOf(await run(options({ narrator: fakeNarrator(invented) })));

		expect(artifact.narration).toBeNull();
		expect(artifact.narrated).toBe(false);
	});

	it('reports the weather stage when the adapter cannot answer', async () => {
		const unreachable: GenerationRunOptions['fetchObservations'] = async () => {
			throw new Error('Open-Meteo answered HTTP 503. No Observations were produced.');
		};

		const result = await run(options({ fetchObservations: unreachable }));

		expect(failureOf(result).stage).toBe('weather');
		expect(failureOf(result).message).toBe('Open-Meteo answered HTTP 503. No Observations were produced.');
		expect('artifact' in result).toBe(false);
	});

	it('reports the plan stage when the planner throws on what it was handed', async () => {
		// An Observation whose timestamp is not an instant is what an adapter bug
		// looks like from in here: the Planner cannot bucket it into a local day
		// and gives up part-way through building the window.
		const unreadable: Observation[] = fixtureObservations.map(observation => ({
			...observation,
			observedAt: 'the day before yesterday',
		}));

		const result = await run(options({ fetchObservations: fakeObservations(unreadable) }));

		expect(failureOf(result).stage).toBe('plan');
		expect('artifact' in result).toBe(false);
	});

	it('refuses an artifact carrying a coordinate pair pasted into a rule name', async () => {
		// The honest route to the coordinate walk. A Rule's name is free text that
		// the Planner carries into a Task title and out into the published file, so
		// a map pin dropped into one reaches the public site unless the run reads
		// the finished Artifact as text. That read is what ADR 0004 asks for.
		const pinned = fixtureSeed.rules.map(rule => rule.id === 'fall-checkup'
			? { ...ruleNamed('fall-checkup'), name: 'Walk the front lawn at 32.7357, -97.1081' }
			: rule);

		const result = await run(options(withRules(pinned)));

		expect(failureOf(result).stage).toBe('validate');
		expect(failureOf(result).message).toContain('32.7357, -97.1081');
		expect('artifact' in result).toBe(false);
	});

	it('refuses an artifact the artifact schema rejects', async () => {
		// Two Rules sharing an id author two Tasks sharing an id, which
		// `planSchema` refuses because check-off is keyed by id alone. Duplicating
		// a Rule is the reachable way to make `parseArtifact` refuse a finished
		// Artifact, which is how this proves the parse runs before anything ships.
		const result = await run(options(withRules([...fixtureSeed.rules, ruleNamed('fall-checkup')])));

		expect(failureOf(result).stage).toBe('validate');
		expect(failureOf(result).message).toContain('task ids must be unique');
		expect('artifact' in result).toBe(false);
	});

	it('publishes a window whose daily means carry long decimals', async () => {
		// The check the walk deliberately does not run. A DailyAggregate is a mean
		// of a day's hourly readings, so a value with ten decimal places is
		// ordinary here, however suspicious the same number would be in a
		// hand-authored seed file. Gating the Artifact on that shape would fail
		// every real run.
		const uneven: Observation[] = fixtureObservations
			.filter((_, index) => index % 4 !== 3)
			.map((observation, index) => index % 3 === 0 ? { ...observation, value: 72 } : observation);

		const artifact = artifactOf(await run(options({ fetchObservations: fakeObservations(uneven) })));

		expect(JSON.stringify(artifact.plan.window)).toMatch(/\d\.\d{3,}/);
	});

	it('writes a status record naming the artifact it just published', async () => {
		const result = await run(options());

		expect(result.status).toEqual({
			attemptedAt: fixtureNow.toISOString(),
			ok: true,
			error: null,
			artifactGeneratedAt: artifactOf(result).generatedAt,
			consecutiveFailures: 0,
		});
	});

	it('carries the previous artifact forward and counts the failure on', async () => {
		// A failed run does not erase the file the site is still serving. The
		// carried count is the only thing in the system that can say tonight is the
		// third bad night rather than one stale file.
		const unreachable: GenerationRunOptions['fetchObservations'] = async () => {
			throw new Error('Open-Meteo answered HTTP 503.');
		};

		const result = await run(options({ fetchObservations: unreachable }));

		expect(result.status).toEqual({
			attemptedAt: fixtureNow.toISOString(),
			ok: false,
			error: 'generation failed at the weather stage: Open-Meteo answered HTTP 503.',
			artifactGeneratedAt: fixturePreviousStatus.artifactGeneratedAt,
			consecutiveFailures: fixturePreviousStatus.consecutiveFailures + 1,
		});
	});

	it('ships the days the rules read rather than the whole fetch', async () => {
		// ADR 0003's actual claim, which the fixture's three days cannot test:
		// the daily run pulls about three months of trailing data and the
		// published file carries roughly a month of it. A fetch shorter than the
		// window proves the window travels, never that it bounds anything.
		const long: Observation[] = Array.from({ length: 90 }, (_unused, index) => {
			const day = new Date(fixtureNow);
			day.setUTCDate(day.getUTCDate() - index);
			return { ...fixtureObservations[0]!, observedAt: day.toISOString(), value: 74 };
		});

		const artifact = artifactOf(await run(options({ fetchObservations: fakeObservations(long) })));
		const days = new Set(artifact.plan.window.map(aggregate => aggregate.date));

		expect(days.size).toBeGreaterThan(1);
		expect(days.size).toBeLessThanOrEqual(PLAN_WINDOW_DAYS);
	});

	it('resets the failure count on a run that publishes', async () => {
		const result = await run(options());

		expect(fixturePreviousStatus.consecutiveFailures).toBeGreaterThan(0);
		expect(result.status.consecutiveFailures).toBe(0);
	});
});
