import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeNarrator } from '../src/generation/narrator';
import { DEFAULT_STATUS, EXIT_SKIPPED, generate, readPreviousStatus } from './generate';

const DATA_DIR = path.resolve(import.meta.dirname, '../data');

// The committed placeholders, read rather than retyped. They are the only description of the format
// the writer has to match, and a fixture typed out by hand would stop matching the real files the
// first time somebody reformatted them.
const COMMITTED_STATUS = readFileSync(path.join(DATA_DIR, 'status.json'), 'utf8');
const COMMITTED_ARTIFACT = readFileSync(path.join(DATA_DIR, 'artifact.json'), 'utf8');

const LOCATION = { latitude: 32, longitude: -97, timeZone: 'America/Chicago' };

const SEED = { yard: { site: 'somewhere' }, plants: [], rules: [], occurrences: [], tagPolicy: {} };

const PREVIOUS_STATUS = {
	attemptedAt: '2026-09-10T11:04:11Z',
	ok: true,
	error: null,
	artifactGeneratedAt: '2026-09-10T11:04:09Z',
	consecutiveFailures: 0,
};

const FAILURE = { stage: 'weather', message: 'Open-Meteo answered HTTP 503.' };

const FAILED_STATUS = {
	attemptedAt: '2026-09-11T11:04:11Z',
	ok: false,
	error: 'generation failed at the weather stage: Open-Meteo answered HTTP 503.',
	artifactGeneratedAt: '2026-09-10T11:04:09Z',
	consecutiveFailures: 1,
};

let directory;
let statusFile;
let artifactFile;

beforeEach(() => {
	directory = mkdtempSync(path.join(tmpdir(), 'rootstock-generate-spec-'));
	statusFile = path.join(directory, 'status.json');
	artifactFile = path.join(directory, 'artifact.json');
});

/**
 * A stand-in for the generation run that answers with whatever outcome the test needs and records
 * what it was called with. Faking at this seam rather than at the adapter keeps the suite off the
 * network and away from codex while still exercising every line `generate` owns.
 */
function fakeRun(result) {
	const calls = [];
	return {
		run: async (options) => {
			calls.push(options);
			return result;
		},
		calls,
	};
}

function options(run, overrides = {}) {
	return {
		run,
		fetchObservations: async () => [],
		narrator: fakeNarrator({ summary: 'Quiet week.', tasks: [], advisories: [] }),
		seed: SEED,
		location: LOCATION,
		previousStatus: PREVIOUS_STATUS,
		now: new Date('2026-09-11T11:04:11Z'),
		statusFile,
		artifactFile,
		...overrides,
	};
}

describe('generate on a successful run', () => {
	it('writes the status record in the committed format, byte for byte', async () => {
		const { run } = fakeRun({ artifact: JSON.parse(COMMITTED_ARTIFACT), status: JSON.parse(COMMITTED_STATUS) });

		await generate(options(run));

		expect(readFileSync(statusFile, 'utf8')).toBe(COMMITTED_STATUS);
	});

	// The artifact is the larger of the two and the one with nesting deep enough for an indentation
	// mismatch to hide in, so it gets the same byte comparison rather than a shape assertion.
	it('writes the artifact in the committed format, byte for byte', async () => {
		const { run } = fakeRun({ artifact: JSON.parse(COMMITTED_ARTIFACT), status: JSON.parse(COMMITTED_STATUS) });

		await generate(options(run));

		expect(readFileSync(artifactFile, 'utf8')).toBe(COMMITTED_ARTIFACT);
	});

	it('hands the run every collaborator it was given', async () => {
		const { run, calls } = fakeRun({ artifact: JSON.parse(COMMITTED_ARTIFACT), status: JSON.parse(COMMITTED_STATUS) });
		const given = options(run);

		await generate(given);

		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual({
			fetchObservations: given.fetchObservations,
			narrator: given.narrator,
			now: given.now,
			location: LOCATION,
			seed: SEED,
			previousStatus: PREVIOUS_STATUS,
		});
	});

	// The two output paths are the only thing standing between a dry run and the committed files, so
	// `run` never sees them.
	it('keeps the output paths to itself', async () => {
		const { run, calls } = fakeRun({ artifact: JSON.parse(COMMITTED_ARTIFACT), status: JSON.parse(COMMITTED_STATUS) });

		await generate(options(run));

		expect(calls[0].statusFile).toBeUndefined();
		expect(calls[0].artifactFile).toBeUndefined();
	});

	it('returns the run result for the caller to narrow', async () => {
		const artifact = JSON.parse(COMMITTED_ARTIFACT);
		const { run } = fakeRun({ artifact, status: JSON.parse(COMMITTED_STATUS) });

		const result = await generate(options(run));

		expect('artifact' in result).toBe(true);
		expect(result.artifact).toBe(artifact);
	});
});

describe('generate on a failed run', () => {
	// A failed run still has to record that it tried, or nothing downstream can tell a stalled runner
	// from a quiet week in the yard.
	it('writes the status record anyway', async () => {
		const { run } = fakeRun({ failure: FAILURE, status: FAILED_STATUS });

		await generate(options(run));

		expect(JSON.parse(readFileSync(statusFile, 'utf8'))).toEqual(FAILED_STATUS);
	});

	it('writes the failed status in the same tab-indented format', async () => {
		const { run } = fakeRun({ failure: FAILURE, status: FAILED_STATUS });

		await generate(options(run));

		const written = readFileSync(statusFile, 'utf8');
		expect(written).toBe(`${JSON.stringify(FAILED_STATUS, null, '\t')}\n`);
		expect(written.endsWith('}\n')).toBe(true);
	});

	// The published site keeps serving the last good artifact through a bad night. A run that
	// truncated or half-wrote the file on its way to reporting failure would take the site down over
	// a weather API having a bad minute.
	it('leaves the existing artifact untouched', async () => {
		const sentinel = 'the artifact from a night that worked\n';
		writeFileSync(artifactFile, sentinel);
		const { run } = fakeRun({ failure: FAILURE, status: FAILED_STATUS });

		await generate(options(run));

		expect(readFileSync(artifactFile, 'utf8')).toBe(sentinel);
	});

	it('returns the failure for the caller to report', async () => {
		const { run } = fakeRun({ failure: FAILURE, status: FAILED_STATUS });

		const result = await generate(options(run));

		expect('artifact' in result).toBe(false);
		expect(result.failure).toEqual(FAILURE);
	});
});

describe('readPreviousStatus', () => {
	it('reads a status record off disk', () => {
		writeFileSync(statusFile, `${JSON.stringify(PREVIOUS_STATUS, null, '\t')}\n`);

		expect(readPreviousStatus(statusFile)).toEqual(PREVIOUS_STATUS);
	});

	it('reads the committed placeholder', () => {
		expect(readPreviousStatus(path.join(DATA_DIR, 'status.json'))).toEqual(JSON.parse(COMMITTED_STATUS));
	});

	// A first run on a fresh checkout. Refusing to start because there is no history yet would mean
	// the file could only ever be created by hand.
	it('falls back when the file is not there', () => {
		expect(readPreviousStatus(path.join(directory, 'nothing.json'))).toEqual(DEFAULT_STATUS);
	});

	it('falls back when the file is not JSON', () => {
		writeFileSync(statusFile, 'half a fi');

		expect(readPreviousStatus(statusFile)).toEqual(DEFAULT_STATUS);
	});

	// The run increments `consecutiveFailures`, so a string in that slot would publish a streak of 31
	// after three bad nights. That is the one of these three fallbacks a reader would see on the site.
	it('falls back when the JSON is not a status record', () => {
		writeFileSync(statusFile, JSON.stringify({ ...PREVIOUS_STATUS, consecutiveFailures: '3' }));

		expect(readPreviousStatus(statusFile)).toEqual(DEFAULT_STATUS);
	});

	it('offers a fallback the schema accepts', () => {
		writeFileSync(statusFile, JSON.stringify(DEFAULT_STATUS));

		expect(readPreviousStatus(statusFile)).toEqual(DEFAULT_STATUS);
	});
});

// `scripts/daily-run.sh` branches on this number by hand, because bash cannot import it. Nothing
// else in the repo would notice it changing, so this is the whole contract between the two files.
describe('the skipped exit code', () => {
	it('is 3, which scripts/daily-run.sh branches on', () => {
		expect(EXIT_SKIPPED).toBe(3);
	});

	// A skip is neither the job succeeding nor the job failing, and the shell tells all three apart.
	// Collapsing it onto either one would make a skipped run look like a crash or hide a real one.
	it('is neither success nor failure', () => {
		expect(EXIT_SKIPPED).not.toBe(0);
		expect(EXIT_SKIPPED).not.toBe(1);
	});
});
