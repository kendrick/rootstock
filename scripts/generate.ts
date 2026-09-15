/*
 * The nightly run, wired up. `src/generation/run.ts` is the composition root and deliberately
 * touches no filesystem; this file is the other half. It reads the environment, picks the real
 * adapter and the real narrator, and decides where the two output files land.
 *
 * `generate` takes every collaborator as an argument for the same reason the run below it does: the
 * spec redirects both output paths into a temp directory and hands in a fake `run`, so the writes
 * can be checked without a network call, a model call, or a byte landing in data/. The CLI block at
 * the bottom is the only code here that reads `process.env` or reaches for `data/`.
 */

import type { StatusRecord } from '../src/artifact/artifact';
import type { Narrator } from '../src/generation/narrator';
import type { GenerationResult } from '../src/generation/run';
import type { SeedData } from '../src/store/store';
import type { Location } from '../src/weather/location';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseStatusRecord } from '../src/artifact/artifact';
import { run } from '../src/generation/run';
import { seedOccurrences, seedPlants, seedRules, seedTagPolicy, seedYard } from '../src/seed';
import { readLocationFromEnv } from '../src/weather/location';
import { fetchObservations } from '../src/weather/open-meteo';
import { createCodexNarrator } from './codex-narrator';
import { todaysRun } from './todays-run';

/**
 * Everything one invocation needs, with nothing defaulted. Three members are arguments only so a
 * caller can substitute them: `run`, so a spec can name the outcome instead of provoking it, and
 * `statusFile` and `artifactFile`, so `--dry-run` can send the writes somewhere else without
 * `generate` learning that it happened.
 *
 * The rest reach `run` untouched, typed off the modules that define them rather than restated here,
 * so a signature change upstream breaks this file at compile time.
 */
export interface GenerateOptions {
	run: typeof run;
	fetchObservations: typeof fetchObservations;
	narrator: Narrator;
	seed: SeedData;
	location: Location;
	previousStatus: StatusRecord;
	now: Date;
	statusFile: string;
	artifactFile: string;
}

/**
 * The status a run starts from when `data/status.json` is missing or unreadable: a first run on a
 * fresh checkout, or a file something truncated mid-write. The epoch is a real datetime that
 * `statusRecordSchema` accepts, so the run carries on with a record that is merely old rather than
 * refusing to start over bookkeeping.
 *
 * An unreadable status file says nothing about how last night went, so `consecutiveFailures` starts
 * at zero. Inventing a streak here would put a failure banner on a site whose artifact is fine.
 */
export const DEFAULT_STATUS: StatusRecord = {
	attemptedAt: '1970-01-01T00:00:00.000Z',
	ok: false,
	error: null,
	artifactGeneratedAt: null,
	consecutiveFailures: 0,
};

/**
 * The one writer, byte for byte what `scripts/generate-schema.ts` does. `data/status.json` and
 * `data/artifact.json` are committed, so a writer that indented with spaces or dropped the trailing
 * newline would rewrite both files whole on every run and bury the one line that actually changed.
 */
function writeJson(file: string, value: unknown): void {
	writeFileSync(file, `${JSON.stringify(value, null, '\t')}\n`);
}

/**
 * Last night's status, or {@link DEFAULT_STATUS} if there is nothing usable on disk. A missing file,
 * malformed JSON, and JSON of the wrong shape all land in the same catch, because the run's answer
 * to all three is the same and none of them is worth failing over before the work has started.
 *
 * It parses rather than casts because the run reads `consecutiveFailures` and increments it: a
 * string in that slot publishes `"3" + 1` as a streak of `31`.
 */
export function readPreviousStatus(file: string): StatusRecord {
	try {
		return parseStatusRecord(JSON.parse(readFileSync(file, 'utf8')));
	}
	catch {
		return DEFAULT_STATUS;
	}
}

/**
 * Runs one generation and writes what came out. Returns the run's own result untouched, so the
 * caller narrows with `'artifact' in result` exactly as it would calling `run` directly.
 *
 * On success it writes the artifact before the status. The site reads the status record to decide
 * whether to trust the artifact beside it, so a status written first would spend a moment pointing
 * at a file that is not there yet. On failure there is no artifact to write and the committed one
 * stays exactly where it is, so the site keeps serving yesterday's plan. That is what
 * `artifactGeneratedAt` surviving a failed run is for.
 */
export async function generate(options: GenerateOptions): Promise<GenerationResult> {
	const result = await options.run({
		fetchObservations: options.fetchObservations,
		narrator: options.narrator,
		now: options.now,
		location: options.location,
		seed: options.seed,
		previousStatus: options.previousStatus,
	});

	if ('artifact' in result) {
		writeJson(options.artifactFile, result.artifact);
	}
	writeJson(options.statusFile, result.status);

	return result;
}

const DATA_DIR = path.resolve(import.meta.dirname, '../data');

/**
 * The exit code a skipped run reports, distinct from both success and failure because
 * `scripts/daily-run.sh` has to tell three outcomes apart and only two of them are its own.
 *
 * Not 0: the shell reads an unchanged `data/status.json` as "the generator died before writing a
 * record", and a skip leaves it unchanged for an entirely different reason. Not 1: a skip is the
 * job working, and a scheduler that alerts on it would page somebody every day the second machine
 * did its job.
 *
 * This number crosses into bash with no compiler in between, which is why it is a named constant
 * here, a pinned spec case, and a commented literal there.
 */
export const EXIT_SKIPPED = 3;

/**
 * Where tonight's two files go. A dry run gets a fresh temp directory each time so two rehearsals
 * cannot read each other's output, and so nothing has to be cleaned up before the next one.
 */
function outputDirectory(dryRun: boolean): string {
	return dryRun ? mkdtempSync(path.join(tmpdir(), 'rootstock-generate-')) : DATA_DIR;
}

/**
 * The CLI. Returns the exit code rather than calling `process.exit`, which would cut stdout off
 * mid-flush and swallow the two paths it just printed.
 *
 * A dry run exits 0 whatever the run did, because it answers one question: is the pipeline wired up.
 * Going red over a weather service having a bad night would make it useless as a pre-flight check
 * under `set -e`.
 *
 * `previousStatus` comes from the real `data/status.json` even on a dry run. `consecutiveFailures`
 * is an input to the record the run produces, so a rehearsal that read a blank one would report a
 * different streak than the real run it stands in for.
 *
 * It also decides whether to run at all. The owner schedules this on more than one machine, and a
 * generation reaches Open-Meteo and then spends a `codex exec` call, so a box that finds today's
 * Plan already published returns {@link EXIT_SKIPPED} without touching either output file. Nothing
 * is written on that path, which matters: a skip that left a status record behind would raise
 * `consecutiveFailures` and paint a failure banner on a site that is perfectly healthy.
 */
async function main(argv: readonly string[]): Promise<number> {
	const dryRun = argv.includes('--dry-run');
	const force = argv.includes('--force');

	// Read before the skip check rather than inside the call below, because the check needs all
	// three. A missing ROOTSTOCK_TIME_ZONE still throws here, which is the right order: a box that
	// cannot say which day it is locally must not be the one deciding today is already done.
	const location = readLocationFromEnv();
	const previousStatus = readPreviousStatus(path.join(DATA_DIR, 'status.json'));
	const now = new Date();

	// A dry run never skips. It answers one question—is the pipeline wired up—and a rehearsal that
	// short-circuits on yesterday's bookkeeping answers nothing.
	if (!dryRun && !force) {
		const today = todaysRun({ status: previousStatus, now, timeZone: location.timeZone });
		if (today.ran) {
			// Both values, because a reader finding this line in a log needs to tell "today is
			// genuinely done" from "ROOTSTOCK_TIME_ZONE is wrong and this box thinks it is yesterday".
			console.log(`skipped: ${today.asOf} already has a plan, published at ${today.artifactGeneratedAt}. Pass --force to generate anyway.`);
			return EXIT_SKIPPED;
		}
	}

	const directory = outputDirectory(dryRun);
	const statusFile = path.join(directory, 'status.json');
	const artifactFile = path.join(directory, 'artifact.json');

	const result = await generate({
		run,
		fetchObservations,
		narrator: createCodexNarrator(),
		seed: {
			yard: seedYard,
			plants: seedPlants,
			rules: seedRules,
			occurrences: seedOccurrences,
			tagPolicy: seedTagPolicy,
		},
		location,
		previousStatus,
		now,
		statusFile,
		artifactFile,
	});

	console.log(`status: ${statusFile}`);

	if ('artifact' in result) {
		console.log(`artifact: ${artifactFile}`);
		return 0;
	}

	// The status file carries this same sentence, but nobody watching a scheduled run reads a JSON
	// file to find out why it went red.
	console.error(`generation failed at the ${result.failure.stage} stage: ${result.failure.message}`);
	return dryRun ? 0 : 1;
}

/*
 * Only run when this file is the program. Without the guard, importing `generate` from the spec
 * would launch codex and hit Open-Meteo.
 */
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	process.exitCode = await main(process.argv.slice(2));
}
