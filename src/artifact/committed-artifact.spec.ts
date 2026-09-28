import type { Plan } from '@/planner/plan';
import type { Task } from '@/planner/task';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseStatusRecord, safeParseArtifact } from '@/artifact/artifact';
import { findCoordinateKeys, findCoordinatePairs, seedRules } from '@/seed';
import { findUnresolvedNarratedTaskIds, findUnresolvedRuleIds } from './committed-artifact';
import { narratedArtifact } from './fixtures';

// A self-contained fixture rather than `narratedArtifact`: that fixture's
// ruleIds only have to be internally consistent, not stay in step with
// whatever `src/seed/rules.json` holds today, so checking it against the
// real seed would fail on drift the fixture owns and this spec does not.
function fixtureTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'valid-rule@test-plant',
		ruleId: 'valid-rule',
		plantId: 'test-plant',
		status: 'fired',
		citation: { kind: 'window', date: '2026-09-11' },
		deferrals: [],
		annotations: [],
		delegable: true,
		tags: [],
		title: 'Test task',
		guardChecks: null,
		...overrides,
	};
}

function fixturePlan(tasks: Task[]): Plan {
	return { asOf: '2026-09-11', tasks, window: [] };
}

/*
 * #60: the suite validates the seed thoroughly and the Artifact's schema,
 * but never the file `data/artifact.json` and `data/status.json` the site
 * actually serves. A malformed one does not fail the build, because the
 * Artifact gate parses it client-side and renders the error state instead.
 * This is the one place that catches a bad publish before a reader does.
 */

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');
const artifactText = readFileSync(join(DATA_DIR, 'artifact.json'), 'utf-8');
const statusText = readFileSync(join(DATA_DIR, 'status.json'), 'utf-8');
const artifactJson: unknown = JSON.parse(artifactText);
const statusJson: unknown = JSON.parse(statusText);

describe('the committed artifact and status record parse', () => {
	// `safeParseArtifact` returns a value rather than throwing, because the
	// browser has to render an error state instead of crashing. This test
	// throws the failure by hand instead, which puts the parser's own
	// sentence in the output rather than a bare `ok: false`.
	it('data/artifact.json parses through safeParseArtifact', () => {
		const result = safeParseArtifact(artifactJson);
		if (!result.ok) {
			throw new Error(result.error);
		}
		expect(result.value.version).toBe(1);
	});

	// `parseStatusRecord` throws on its own, so a malformed status record fails
	// this test with the parser's sentence with no extra plumbing.
	it('data/status.json parses through parseStatusRecord', () => {
		const status = parseStatusRecord(statusJson);
		expect(status.attemptedAt).toEqual(expect.any(String));
	});
});

describe('every ruleId and guardId the committed artifact names resolves against src/seed/rules.json', () => {
	const ruleIds = new Set(seedRules.map(rule => rule.id));

	function parsedPlan() {
		const result = safeParseArtifact(artifactJson);
		if (!result.ok) {
			throw new Error(result.error);
		}
		return result.value;
	}

	it('resolves every Task ruleId, Deferral guardId, Annotation guardId, and guardChecks guardId', () => {
		expect(findUnresolvedRuleIds(parsedPlan().plan, ruleIds)).toEqual([]);
	});

	// narration.tasks carries a taskId, not a ruleId (narration.ts: a Rule can
	// fire for several Plants, so the task id is the precise handle). Checking
	// it against Rule ids would be the wrong membership test even though it
	// shares the word "id" with the field above.
	it('resolves every narration.tasks taskId against a Task the committed Plan holds', () => {
		const artifact = parsedPlan();
		expect(findUnresolvedNarratedTaskIds(artifact.narration, artifact.plan)).toEqual([]);
	});

	// A check that cannot fail is worse than no check: proves the helper above
	// actually flags a retired ruleId, on a fixture rather than the committed
	// file. #60 asks for that proof without touching the real
	// data/artifact.json.
	it('reports a task whose ruleId names a rule the seed no longer holds', () => {
		const plan = fixturePlan([fixtureTask({ id: 'retired-rule@test-plant', ruleId: 'retired-rule' })]);

		expect(findUnresolvedRuleIds(plan, new Set(['valid-rule']))).toEqual([
			'task \'retired-rule@test-plant\' ruleId names unknown rule \'retired-rule\'',
		]);
	});

	it('reports a deferral, an annotation, and a guardChecks entry whose guardId names a retired Guard', () => {
		const plan = fixturePlan([fixtureTask({
			status: 'deferred',
			deferrals: [{ guardId: 'retired-guard', releaseWhen: 'never' }],
			annotations: [{ guardId: 'another-retired-guard', text: 'irrelevant' }],
			guardChecks: [{ guardId: 'a-third-retired-guard', verdict: 'met' }],
		})]);

		expect(findUnresolvedRuleIds(plan, new Set(['valid-rule']))).toEqual([
			'task \'valid-rule@test-plant\' deferral guardId names unknown rule \'retired-guard\'',
			'task \'valid-rule@test-plant\' annotation guardId names unknown rule \'another-retired-guard\'',
			'task \'valid-rule@test-plant\' guardChecks guardId names unknown rule \'a-third-retired-guard\'',
		]);
	});

	it('reports a narrated taskId that names no Task in the Plan', () => {
		const broken = structuredClone(narratedArtifact);
		broken.narration!.tasks = [{ taskId: 'no-such-task', text: 'irrelevant' }];

		expect(findUnresolvedNarratedTaskIds(broken.narration, broken.plan)).toEqual([
			'narration task references unknown task \'no-such-task\'',
		]);
	});
});

describe('the committed artifact obeys ADR 0004', () => {
	// findLongDecimals is deliberately NOT run over data/artifact.json here.
	// It flags a bare JSON number with three or more decimal places, and
	// `Plan.window` carries reduced daily means. An hourly average that lands
	// on 94.75416666666666 is routine, not a leaked coordinate, and applying
	// the same detector the seed specs use would fire on every single run.
	// findCoordinateKeys and findCoordinatePairs below carry no such false
	// positive, so ADR 0004 is still enforced on the value the schema walk in
	// no-coordinates.spec.ts cannot see.
	it('data/artifact.json carries no key that reads like a coordinate', () => {
		expect(findCoordinateKeys(artifactText)).toEqual([]);
	});

	it('data/artifact.json carries no coordinate pair inside a string', () => {
		expect(findCoordinatePairs(artifactText)).toEqual([]);
	});
});
