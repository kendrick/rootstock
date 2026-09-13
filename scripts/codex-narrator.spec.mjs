import { EventEmitter } from 'node:events';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CODEX_MODEL, createCodexNarrator } from './codex-narrator';

const SCHEMA_FILE = path.resolve(import.meta.dirname, '../schemas/narration.schema.json');

const PLAN = {
	asOf: '2026-03-14',
	tasks: [
		{
			id: 'prune-dormant@apple-honeycrisp',
			ruleId: 'prune-dormant',
			plantId: 'apple-honeycrisp',
			status: 'fired',
			citation: { kind: 'window', date: '2026-03-14' },
			deferrals: [],
			annotations: [],
			delegable: false,
			tags: ['pruning'],
			title: 'Prune the Honeycrisp while it is still dormant.',
		},
	],
	window: [],
};

const NARRATION = {
	summary: 'A dry week, and the last of the dormant window.',
	tasks: [{ taskId: 'prune-dormant@apple-honeycrisp', text: 'Prune the Honeycrisp before it breaks bud.' }],
	advisories: [],
};

/**
 * A stand-in for `node:child_process.spawn` that launches nothing. The narrator reads exactly two
 * things about a codex run: the exit code, and what the child left in the `-o` file. Those are the
 * two knobs here, and between them they reach every failure shape below.
 */
function fakeSpawn({ code = 0, output, stderr = '' } = {}) {
	const calls = [];

	const spawn = (command, args, options) => {
		// The output path is whatever the narrator chose; reading it back out of the argument list is
		// how this fake writes to the same file the narrator is about to read.
		const outputFile = args[args.indexOf('-o') + 1];
		calls.push({ command, args, options, outputFile });

		const child = new EventEmitter();
		child.stdout = new PassThrough();
		child.stderr = new PassThrough();

		queueMicrotask(() => {
			if (output !== undefined) {
				writeFileSync(outputFile, output);
			}
			if (stderr.length > 0) {
				// Emitted rather than written, so the narrator's listener has it in hand before 'close'.
				// A PassThrough would deliver on a later tick and make the assertion a race.
				child.stderr.emit('data', Buffer.from(stderr));
			}
			child.emit('close', code);
		});

		return child;
	};

	return { spawn, calls };
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('createCodexNarrator', () => {
	it('invokes codex with the contracted argument list', async () => {
		const { spawn, calls } = fakeSpawn({ output: JSON.stringify(NARRATION) });

		await createCodexNarrator(spawn)(PLAN);

		expect(calls).toHaveLength(1);
		expect(calls[0].command).toBe('codex');
		expect(calls[0].args.slice(0, 11)).toEqual([
			'exec',
			'--ephemeral',
			'--skip-git-repo-check',
			'-s',
			'read-only',
			'-m',
			'o4-mini',
			'--output-schema',
			SCHEMA_FILE,
			'-o',
			calls[0].outputFile,
		]);
	});

	// The literal in the test above is the pin. This test proves the argument list is built from
	// `CODEX_MODEL` and not from a second copy of the string that could drift away from it.
	it('takes the model from the one pinned constant', async () => {
		const { spawn, calls } = fakeSpawn({ output: JSON.stringify(NARRATION) });

		await createCodexNarrator(spawn)(PLAN);

		expect(CODEX_MODEL).toBe('o4-mini');
		expect(calls[0].args[calls[0].args.indexOf('-m') + 1]).toBe(CODEX_MODEL);
	});

	it('sends the whole plan as the trailing positional argument', async () => {
		const { spawn, calls } = fakeSpawn({ output: JSON.stringify(NARRATION) });

		await createCodexNarrator(spawn)(PLAN);

		const prompt = calls[0].args.at(-1);
		expect(calls[0].args).toHaveLength(12);
		expect(prompt).toContain(JSON.stringify(PLAN));
	});

	// An inherited or piped stdin turns a misbuilt argument list into a process that waits forever
	// for a prompt, because `codex exec` falls back to reading one from stdin.
	it('gives the child stdin from the null device', async () => {
		const { spawn, calls } = fakeSpawn({ output: JSON.stringify(NARRATION) });

		await createCodexNarrator(spawn)(PLAN);

		expect(calls[0].options.stdio).toEqual(['ignore', 'pipe', 'pipe']);
	});

	it('forwards HOME, PATH and CODEX_HOME, and nothing else', async () => {
		vi.stubEnv('HOME', '/home/gardener');
		vi.stubEnv('PATH', '/opt/homebrew/bin');
		vi.stubEnv('CODEX_HOME', '/home/gardener/.codex');
		const { spawn, calls } = fakeSpawn({ output: JSON.stringify(NARRATION) });

		await createCodexNarrator(spawn)(PLAN);

		expect(calls[0].options.env).toEqual({
			HOME: '/home/gardener',
			PATH: '/opt/homebrew/bin',
			CODEX_HOME: '/home/gardener/.codex',
		});
	});

	it('resolves with the narration when all four conditions hold', async () => {
		const { spawn } = fakeSpawn({ output: JSON.stringify(NARRATION) });

		await expect(createCodexNarrator(spawn)(PLAN)).resolves.toEqual(NARRATION);
	});

	it('removes the output file once it has the answer', async () => {
		const { spawn, calls } = fakeSpawn({ output: JSON.stringify(NARRATION) });

		await createCodexNarrator(spawn)(PLAN);

		expect(existsSync(calls[0].outputFile)).toBe(false);
	});

	// codex opens the schema by path, so a path that resolves nowhere fails the whole run at launch
	// with nothing here to catch it first.
	it('points --output-schema at a committed schema file', async () => {
		const { spawn, calls } = fakeSpawn({ output: JSON.stringify(NARRATION) });

		await createCodexNarrator(spawn)(PLAN);

		expect(JSON.parse(readFileSync(calls[0].args[8], 'utf8'))).toMatchObject({ type: 'object' });
	});
});

describe('createCodexNarrator failures', () => {
	it('rejects when codex exits non-zero', async () => {
		const { spawn } = fakeSpawn({ code: 1, stderr: 'stream error: 401 Unauthorized' });

		await expect(createCodexNarrator(spawn)(PLAN)).rejects.toThrow(
			/exited with code 1 rather than 0, so no narration was produced\. It wrote this to stderr: stream error: 401 Unauthorized/,
		);
	});

	it('rejects when codex exits zero having left the output file empty', async () => {
		const { spawn } = fakeSpawn({ code: 0, output: '' });

		await expect(createCodexNarrator(spawn)(PLAN)).rejects.toThrow(
			/exited 0 but wrote nothing to .*, so there is no narration to read/,
		);
	});

	// The same failure as an empty file, and deliberately the same sentence. Codex exited 0 without
	// answering, and which of the two ways it did that is nothing a reader could act on.
	it('rejects when codex exits zero having written no output file at all', async () => {
		const { spawn } = fakeSpawn({ code: 0 });

		await expect(createCodexNarrator(spawn)(PLAN)).rejects.toThrow(
			/exited 0 but wrote nothing to .*, so there is no narration to read/,
		);
	});

	// A model handed a strict output schema can still answer with a refusal in prose.
	it('rejects when the output file is not JSON', async () => {
		const { spawn } = fakeSpawn({ code: 0, output: 'I am sorry, I cannot help with that.' });

		await expect(createCodexNarrator(spawn)(PLAN)).rejects.toThrow(
			/is not JSON \(.+\), so no narration could be read\. It begins: I am sorry/,
		);
	});

	it('rejects when the output file is JSON of the wrong shape', async () => {
		const { spawn } = fakeSpawn({ code: 0, output: JSON.stringify({ summary: 'Fine week.', tasks: [] }) });

		await expect(createCodexNarrator(spawn)(PLAN)).rejects.toThrow(
			/returned JSON that is not a narration\. narration: advisories/,
		);
	});

	it('removes the output file even when the run fails', async () => {
		const { spawn, calls } = fakeSpawn({ code: 0, output: 'not json' });

		await expect(createCodexNarrator(spawn)(PLAN)).rejects.toThrow();
		expect(existsSync(calls[0].outputFile)).toBe(false);
	});

	// Every message is one a person reads cold in a CI log with nothing else to go on, so each has to
	// be a sentence and not a code.
	it('names the failure in a sentence every time', async () => {
		const shapes = [
			{ code: 1 },
			{ code: 0, output: '' },
			{ code: 0, output: 'nonsense' },
			{ code: 0, output: JSON.stringify({ summary: 'x' }) },
		];

		for (const shape of shapes) {
			const { spawn } = fakeSpawn(shape);
			const error = await createCodexNarrator(spawn)(PLAN).catch(caught => caught);

			expect(error).toBeInstanceOf(Error);
			expect(error.message.startsWith('codex narrator: ')).toBe(true);
			expect(error.message.split(' ').length).toBeGreaterThan(8);
		}
	});
});

describe('createCodexNarrator with the real spawn', () => {
	// Every other test here passes a fake, which leaves the default argument itself unexercised. This
	// one gets as close as a spec can without launching codex.
	it('defaults to node:child_process.spawn', () => {
		expect(typeof createCodexNarrator()).toBe('function');
		expect(typeof process.env.PATH).toBe('string');
	});
});
