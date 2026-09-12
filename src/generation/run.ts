import type { GenerationFailure } from './failure';
import type { Narrator } from './narrator';
import type { Artifact, StatusRecord } from '@/artifact/artifact';
import type { Narration } from '@/artifact/narration';
import type { Plan } from '@/planner/plan';
import type { SeedData } from '@/store/store';
import type { Location } from '@/weather/location';
import type { Observation } from '@/weather/observation';
import type { fetchObservations } from '@/weather/open-meteo';
import { parseArtifact } from '@/artifact/artifact';
import { localDate } from '@/planner/dates';
import { plan } from '@/planner/planner';
import { toGenerationFailure } from './failure';
import { validateNarration } from './narrator';

/**
 * Derived off the real adapter rather than written out here, the same way
 * `@/weather/fake-adapter` derives it. A change to `fetchObservations`'s
 * signature then breaks this file at compile time, instead of leaving a
 * composition root that calls the adapter with arguments no other caller uses.
 */
type FetchObservations = typeof fetchObservations;

/**
 * Everything one generation run is given, which is everything it has. No field
 * here carries a default, and that is the point of the interface: the run holds
 * no adapter, no model, no yard, and no clock of its own. A run only reaches the
 * network because a caller handed it something that does.
 */
export interface GenerationRunOptions {
	fetchObservations: FetchObservations;
	narrator: Narrator;
	now: Date;
	location: Location;
	seed: SeedData;
	previousStatus: StatusRecord;
}

/**
 * The two ways a run can end, as a union rather than one object with both
 * halves optional. A failed run has no Artifact to publish and a successful one
 * has no failure to report, and a single shape carrying both would leave every
 * caller free to read the field that is not there. Callers narrow with
 * `'artifact' in result`.
 *
 * The status record is on both arms because it is written on both paths. A run
 * that could not produce an Artifact still has to say that it tried, or the
 * site has no way to tell a stalled runner from a quiet week in the yard.
 */
export type GenerationResult
	= | { artifact: Artifact; status: StatusRecord }
		| { failure: GenerationFailure; status: StatusRecord };

/*
 * The coordinate walk, copied from `src/seed/index.ts` rather than imported
 * from it. That module parses the committed yard at import time, so importing
 * two regular expressions out of it would drag `plants.json`, `rules.json` and
 * every schema behind them into the generation path. The duplication is
 * deliberate, and the two copies have to stay in step. Hoisting both checks
 * into a module of their own is worth doing once a third caller needs them.
 *
 * `findLongDecimals` is the third check over there and is deliberately not
 * here. A bare number with three or more decimal places is a hand-authored
 * coordinate in a seed file and an ordinary value in an Artifact, because a
 * DailyAggregate is a mean of twenty-four hourly readings and 56.234166666 is
 * what a mean looks like. Running that check here would fail every real run.
 */
const COORDINATE_KEY = /lat|lon|lng|coord/i;

// Two signed decimals of three or more places separated by a comma. Narrow
// enough to read inside quoted strings without a product URL or a version
// number tripping it, which matters because a Rule's name and a Guard's
// release sentence are free text that reaches the published file verbatim.
const COORDINATE_PAIR = /-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/;

/**
 * Reads the finished Artifact as text and refuses anything shaped like the
 * property's location. ADR 0004 keeps the coordinates in the generation
 * environment, and this file is published to a public site, so the check runs
 * against the serialized Artifact rather than against its fields: a schema walk
 * can see that `title` is a string and cannot see that somebody pasted a map
 * pin into a Rule name.
 */
function assertNoCoordinates(artifact: Artifact): void {
	const json = JSON.stringify(artifact);

	for (const match of json.matchAll(/"([^"]+)"\s*:/g)) {
		const key = match[1];
		if (key !== undefined && COORDINATE_KEY.test(key)) {
			throw new Error(`artifact: the field '${key}' is named like a coordinate, which docs/adr/0004-coordinates-never-enter-the-repository.md keeps out of the published file.`);
		}
	}

	const pair = COORDINATE_PAIR.exec(json);
	if (pair !== null) {
		throw new Error(`artifact: free text in the artifact carries '${pair[0]}', which is shaped like a coordinate pair and cannot be published (docs/adr/0004-coordinates-never-enter-the-repository.md).`);
	}
}

/**
 * Runs the narrator and answers with null for every way it can go wrong: a
 * throw, a rejection, and a Narration citing a Task the Plan never contained
 * all land here. ADR 0001 makes the Planner's mechanical title the thing the
 * interface renders by default, so a run with no prose is a complete run rather
 * than a broken one. The caller gets the same successful result either way.
 */
async function narrate(planned: Plan, narrator: Narrator): Promise<Narration | null> {
	try {
		const narration = await narrator(planned);
		validateNarration(narration, planned);
		return narration;
	}
	catch {
		return null;
	}
}

/**
 * The status record a failed run leaves behind. `artifactGeneratedAt` is
 * carried forward rather than cleared because the site is still serving
 * yesterday's Artifact, and a null here would tell a reader the file is gone.
 * `consecutiveFailures` counts up from the previous record for the reason
 * `statusRecordSchema` gives: one record describes one attempt, so nothing this
 * run observes says whether tonight is the first bad night or the fourth.
 */
function failureResult(failure: GenerationFailure, options: GenerationRunOptions): GenerationResult {
	return {
		failure,
		status: {
			attemptedAt: options.now.toISOString(),
			ok: false,
			error: `generation failed at the ${failure.stage} stage: ${failure.message}`,
			artifactGeneratedAt: options.previousStatus.artifactGeneratedAt,
			consecutiveFailures: options.previousStatus.consecutiveFailures + 1,
		},
	};
}

/**
 * One generation run: fetch the weather, plan the day, narrate the Plan, check
 * what came out, and answer with an Artifact or with the stage that could not
 * finish. This is the composition root, and the only function in the project
 * that holds the adapter, the Planner and the narrator at once.
 *
 * Every input arrives as an argument, including the clock. `now` is a parameter
 * for the same reason the Planner takes `asOf` as one: a run that read
 * `Date.now()` would plan a different day depending on when it happened to
 * start, and the observed-versus-forecast boundary would stop being
 * reproducible. `asOf` is `now` resolved into the property's own time zone,
 * which is the run's entire notion of today. The adapter and the narrator are
 * arguments so a test can drive the whole pipeline with fakes, without reaching
 * for a module mock or a stubbed global. The seed is an argument so the run
 * never decides for itself which yard it is planning.
 *
 * Narration cannot fail the run. A narrator that throws, a narrator that
 * rejects, and a Narration naming a Task the Planner never wrote all produce
 * `narration: null, narrated: false`, and the run carries on to validation and
 * publishes. ADR 0001 rests on that: the Plan is derived before the model is
 * asked anything, so the model's answer can only change the words. Making a bad
 * answer fail the run would turn an optional pass into a fourth way the night's
 * run produces nothing.
 *
 * Nothing here writes a file. The caller decides where the Artifact and the
 * status record land, which keeps this function runnable in a test, in CI, and
 * on the box that commits the result, without any of the three agreeing on a
 * path.
 */
export async function run(options: GenerationRunOptions): Promise<GenerationResult> {
	const asOf = localDate(options.now.toISOString(), options.location.timeZone);

	let observations: Observation[];
	try {
		observations = await options.fetchObservations({ location: options.location, now: options.now });
	}
	catch (cause) {
		return failureResult(toGenerationFailure('weather', cause), options);
	}

	let planned: Plan;
	try {
		planned = plan({
			asOf,
			timeZone: options.location.timeZone,
			plants: options.seed.plants,
			rules: options.seed.rules,
			observations,
			occurrences: options.seed.occurrences,
			tagPolicy: options.seed.tagPolicy,
		});
	}
	catch (cause) {
		return failureResult(toGenerationFailure('plan', cause), options);
	}

	const narration = await narrate(planned, options.narrator);

	// `plan.window` goes out exactly as the Planner returned it. ADR 0003 puts
	// the window on the Plan because only the run that produced a Plan knows
	// which days its Rules read, and trimming or re-sorting it here would make
	// the published sparkline a second opinion about that.
	const artifact: Artifact = {
		version: 1,
		generatedAt: options.now.toISOString(),
		plan: planned,
		narration,
		narrated: narration !== null,
	};

	try {
		parseArtifact(artifact);
		assertNoCoordinates(artifact);
	}
	catch (cause) {
		return failureResult(toGenerationFailure('validate', cause), options);
	}

	return {
		artifact,
		status: {
			attemptedAt: options.now.toISOString(),
			ok: true,
			error: null,
			artifactGeneratedAt: artifact.generatedAt,
			consecutiveFailures: 0,
		},
	};
}
