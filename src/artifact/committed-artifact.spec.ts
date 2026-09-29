import type { Plan } from '@/planner/plan';
import type { Task } from '@/planner/task';
import type { GuardRule, WindowRule } from '@/rules/rule';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseStatusRecord, safeParseArtifact } from '@/artifact/artifact';
import { seedPlannedFrom } from '@/artifact/planned-from';
import { findCoordinateFieldNames, findCoordinatePairs, seedRules } from '@/seed';
import { findUnresolvedNarratedTaskIds, findUnresolvedRuleIds, showsPlannedFromNotice } from './committed-artifact';
import { narratedArtifact } from './fixtures';

const REGION = { name: 'Test County', hardinessZone: '8b' };
const OWNER_SOURCE = { kind: 'owner' as const, label: 'Test practice', url: null };
const WHOLE_YARD = { plantIds: null, plantTags: null, ruleTags: null };

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

// A task-creating Rule fixture, kept to the `window` kind since the check
// under test only cares that `kind !== 'guard'`.
function fixtureWindowRule(overrides: Partial<WindowRule> = {}): WindowRule {
	return {
		id: 'valid-rule',
		kind: 'window',
		name: 'Test window rule',
		region: REGION,
		source: OWNER_SOURCE,
		tags: [],
		delegable: true,
		priority: 0,
		appliesTo: WHOLE_YARD,
		productLabel: null,
		start: '01-01',
		end: '02-01',
		...overrides,
	};
}

function fixtureGuardRule(overrides: Partial<GuardRule> = {}): GuardRule {
	return {
		id: 'valid-guard',
		kind: 'guard',
		name: 'Test guard rule',
		region: REGION,
		source: OWNER_SOURCE,
		tags: [],
		delegable: true,
		priority: 0,
		appliesTo: WHOLE_YARD,
		productLabel: null,
		condition: { kind: 'always' },
		effect: 'annotate',
		text: 'Test annotation',
		...overrides,
	} as GuardRule;
}

/*
 * #60: the suite validates the seed thoroughly and the Artifact's schema,
 * but never the file `data/artifact.json` and `data/status.json` the site
 * actually serves. A malformed one does not fail the build, because the
 * Artifact gate parses it client-side and renders the error state instead.
 * deploy.yml runs this spec before it builds, because the daily run pushes
 * straight to main and CI failing beside the deploy would stop nothing.
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

	// run.ts: publishedResult stamps status.artifactGeneratedAt from the very
	// Artifact it just published, and failureResult carries the previous
	// status's artifactGeneratedAt forward untouched. generate.ts only writes
	// data/artifact.json when a run publishes, and daily-run.sh commits it
	// "only when it changed" (a failed generation leaves the committed one
	// untouched on purpose), so a failed run moves attemptedAt and error but
	// never artifactGeneratedAt, and never touches artifact.json at all. The
	// two files can't fall out of step by construction. This matters because
	// todaysRun trusts status.artifactGeneratedAt alone, deliberately never
	// reading plan.asOf (todays-run.ts), so a mismatch here would let a
	// scheduled run skip today while the site serves an Artifact older than
	// the status record claims.
	it('status.artifactGeneratedAt names the committed artifact\'s generatedAt', () => {
		const result = safeParseArtifact(artifactJson);
		if (!result.ok) {
			throw new Error(result.error);
		}
		const status = parseStatusRecord(statusJson);

		expect(status.artifactGeneratedAt).toBe(result.value.generatedAt);
	});
});

describe('every ruleId and guardId the committed artifact names resolves against src/seed/rules.json, with the right role', () => {
	function parsedArtifact() {
		const result = safeParseArtifact(artifactJson);
		if (!result.ok) {
			throw new Error(result.error);
		}
		return result.value;
	}

	const artifact = parsedArtifact();

	// ADR 0007: the seed deploys on every push, but the Plan is only remade by
	// the daily run, so a Rule retirement PR can't regenerate the Artifact in
	// CI to match. When plannedFrom no longer agrees with the build's own seed
	// fingerprint, "every ruleId resolves" isn't a claim this committed Plan
	// makes, and ArtifactGate shows its own notice for exactly that gap. This
	// asserts the notice fires instead of failing the build over a window ADR
	// 0007 already allows for.
	it('resolves every Task ruleId, Deferral guardId, Annotation guardId, and guardChecks guardId, or ArtifactGate covers the drift (ADR 0007)', () => {
		if (artifact.plannedFrom === seedPlannedFrom) {
			expect(findUnresolvedRuleIds(artifact.plan, seedRules)).toEqual([]);
		}
		else {
			expect(showsPlannedFromNotice(artifact.plannedFrom, seedPlannedFrom)).toBe(true);
		}
	});

	// narration.tasks carries a taskId, not a ruleId (narration.ts: a Rule can
	// fire for several Plants, so the task id is the precise handle). Checking
	// it against Rule ids would be the wrong membership test even though it
	// shares the word "id" with the field above. Unconditional, unlike the
	// check above: a taskId is checked against this same Plan's own Task ids,
	// so ADR 0007's seed drift has no bearing on whether it holds.
	it('resolves every narration.tasks taskId against a Task the committed Plan holds', () => {
		expect(findUnresolvedNarratedTaskIds(artifact.narration, artifact.plan)).toEqual([]);
	});

	// A check that cannot fail is worse than no check: proves the helper above
	// actually flags a retired ruleId, on a fixture rather than the committed
	// file. #60 asks for that proof without touching the real
	// data/artifact.json.
	it('reports a task whose ruleId names a rule the seed no longer holds', () => {
		const plan = fixturePlan([fixtureTask({ id: 'retired-rule@test-plant', ruleId: 'retired-rule' })]);

		expect(findUnresolvedRuleIds(plan, [fixtureWindowRule({ id: 'valid-rule' })])).toEqual([
			'task \'retired-rule@test-plant\' ruleId \'retired-rule\' does not name a task-creating Rule',
		]);
	});

	// The role check, not just the id check: 'valid-guard' exists, but as a
	// Guard, and a Guard creates no work (CONTEXT.md). A ruleId naming one is
	// exactly as wrong as a ruleId naming nothing, and has to be caught the
	// same way.
	it('reports a task whose ruleId names a Guard rather than a task-creating Rule', () => {
		const plan = fixturePlan([fixtureTask({ id: 'valid-guard@test-plant', ruleId: 'valid-guard' })]);

		expect(findUnresolvedRuleIds(plan, [fixtureGuardRule({ id: 'valid-guard' })])).toEqual([
			'task \'valid-guard@test-plant\' ruleId \'valid-guard\' does not name a task-creating Rule',
		]);
	});

	it('reports a deferral, an annotation, and a guardChecks entry whose guardId names a retired Guard', () => {
		const plan = fixturePlan([fixtureTask({
			status: 'deferred',
			deferrals: [{ guardId: 'retired-guard', releaseWhen: 'never' }],
			annotations: [{ guardId: 'another-retired-guard', text: 'irrelevant' }],
			guardChecks: [{ guardId: 'a-third-retired-guard', verdict: 'met' }],
		})]);

		expect(findUnresolvedRuleIds(plan, [fixtureWindowRule({ id: 'valid-rule' })])).toEqual([
			'task \'valid-rule@test-plant\' deferral guardId \'retired-guard\' does not name a Guard',
			'task \'valid-rule@test-plant\' annotation guardId \'another-retired-guard\' does not name a Guard',
			'task \'valid-rule@test-plant\' guardChecks guardId \'a-third-retired-guard\' does not name a Guard',
		]);
	});

	// The other direction of the same role check: 'valid-rule' exists and is
	// task-creating, so an id-only check would wave a Deferral, an Annotation,
	// and a guardChecks entry naming it straight through, even though none of
	// them named a Guard.
	it('reports a deferral, an annotation, and a guardChecks entry whose guardId names a task-creating Rule rather than a Guard', () => {
		const plan = fixturePlan([fixtureTask({
			status: 'deferred',
			deferrals: [{ guardId: 'valid-rule', releaseWhen: 'never' }],
			annotations: [{ guardId: 'valid-rule', text: 'irrelevant' }],
			guardChecks: [{ guardId: 'valid-rule', verdict: 'met' }],
		})]);

		expect(findUnresolvedRuleIds(plan, [fixtureWindowRule({ id: 'valid-rule' })])).toEqual([
			'task \'valid-rule@test-plant\' deferral guardId \'valid-rule\' does not name a Guard',
			'task \'valid-rule@test-plant\' annotation guardId \'valid-rule\' does not name a Guard',
			'task \'valid-rule@test-plant\' guardChecks guardId \'valid-rule\' does not name a Guard',
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

describe('showsPlannedFromNotice mirrors ArtifactGate\'s own notice condition (ADR 0007)', () => {
	it('is false when plannedFrom agrees with the seed fingerprint', () => {
		expect(showsPlannedFromNotice('abcd1234', 'abcd1234')).toBe(false);
	});

	it('is true when plannedFrom names a different seed fingerprint', () => {
		expect(showsPlannedFromNotice('abcd1234', 'ffff0000')).toBe(true);
	});

	// null means a pre-ADR-0007 Artifact, and ArtifactGate shows no notice for
	// that case either (there's nothing on the Artifact to compare).
	it('is false when plannedFrom is absent', () => {
		expect(showsPlannedFromNotice(null, 'abcd1234')).toBe(false);
	});
});

describe('the committed artifact obeys ADR 0004', () => {
	// findLongDecimals is deliberately NOT run over data/artifact.json here.
	// It flags a bare JSON number with three or more decimal places, and
	// `Plan.window` carries reduced daily means. An hourly average that lands
	// on 94.75416666666666 is routine, not a leaked coordinate, and applying
	// the same detector the seed specs use would fire on every single run.
	// findCoordinateFieldNames and findCoordinatePairs below carry no such false
	// positive, so ADR 0004 is still enforced on the value the schema walk in
	// no-coordinates.spec.ts cannot see.
	// Field names come off the parsed value, never the text. The Narration is
	// free prose, and a quoted word before a colon in a sentence (`"related":`)
	// reads as a key to a text scan and matches `lat`, which would fail CI over
	// an Artifact the generation run already passed. run.ts walks the parsed
	// Artifact for the same reason.
	it('data/artifact.json carries no field named like a coordinate', () => {
		expect(findCoordinateFieldNames(JSON.parse(artifactText))).toEqual([]);
	});

	it('reads field names, not a quoted word in the Narration\'s prose', () => {
		const prose = { narration: { summary: 'The "related": section of the label covers watering in.' } };
		expect(findCoordinateFieldNames(prose)).toEqual([]);
		expect(findCoordinateFieldNames({ plan: { tasks: [{ latitude: 1 }] } })).toEqual(['latitude']);
	});

	it('data/artifact.json carries no coordinate pair inside a string', () => {
		expect(findCoordinatePairs(artifactText)).toEqual([]);
	});
});
