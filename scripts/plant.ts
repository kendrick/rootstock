/*
 * Adds a Plant to the seed inventory, or checks the inventory as it stands.
 *
 *   pnpm plant add      asks for one Plant, shows which Rules will reach it, then appends it to plants.json
 *   pnpm plant check    lists every Plant with the Rules that reach it, and flags what needs attention
 *
 * Both take `--plants <path>` to work on a copy instead of `src/seed/plants.json`.
 *
 * The decisions live in `src/yard/authoring.ts`, so a later local add-plant page reuses them unchanged. This file only asks questions, prints, and writes. The split is the one `site-plants.ts` uses: everything above `main` is a pure function of its arguments.
 */
import type { Rule } from '../src/rules/rule';
import type { Reach } from '../src/yard/authoring';
import type { Plant } from '../src/yard/plant';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { findUnmatchedPlantTags, seedOccurrences, seedRules } from '../src/seed';
import { parseWith } from '../src/validation/parse';
import { authoringVocabulary, draftToPlant, insertPlant, plantDraftSchema, previewReach } from '../src/yard/authoring';
import { plantSchema } from '../src/yard/plant';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PLANTS = path.join(ROOT, 'src/seed/plants.json');

export interface Args {
	command: 'add' | 'check';
	plants: string;
}

export function parseArgs(argv: string[]): Args {
	const [command, ...rest] = argv;

	if (command !== 'add' && command !== 'check') {
		throw new Error('usage: pnpm plant <add|check> [--plants <path>]');
	}

	const flag = rest.indexOf('--plants');
	const plants = flag === -1 ? DEFAULT_PLANTS : rest[flag + 1];

	if (plants === undefined) {
		throw new Error('--plants needs a path');
	}

	return { command, plants: path.resolve(plants) };
}

/** A comma-separated answer as tags, lowercased and without repeats, since tag matching is exact. */
export function parseTags(answer: string): string[] {
	return [...new Set(answer.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag !== ''))];
}

/** A numbered pick from `options`, or the typed text itself when it isn't one. Blank means none. */
export function pickOrType(answer: string, options: string[]): string | null {
	const trimmed = answer.trim();

	if (trimmed === '') {
		return null;
	}

	const index = Number(trimmed);
	return Number.isInteger(index) && index >= 1 && index <= options.length ? options[index - 1]! : trimmed;
}

/** The first option the typed answer begins, so `c` picks `container`. */
export function pickOne<T extends string>(answer: string, options: readonly T[]): T | undefined {
	const typed = answer.trim().toLowerCase();
	return typed === '' ? undefined : options.find(option => option.startsWith(typed));
}

/** `planned` and `planted` share a prefix, so the status question takes [p]lanted or [n]ot yet instead of a prefix. */
export function parseStatus(answer: string): Plant['status'] | undefined {
	const typed = answer.trim().toLowerCase();
	return typed === 'p' || typed === 'planted' ? 'planted' : typed === 'n' || typed === 'planned' ? 'planned' : undefined;
}

export function describeReach(reach: Reach): string {
	if (reach.rules.length === 0) {
		return 'No Rule reaches it, so nothing will be planned for it. That is fine for a Plant that needs no scheduled care.';
	}

	const names = reach.rules.map(rule => `  - ${rule.name} (${rule.id})`).join('\n');
	return reach.now ? `Rules that will plan work for it:\n${names}` : `Rules that will plan work for it once it is planted:\n${names}`;
}

/**
 * What `pnpm plant check` prints. A planted Plant with no Pin is fine when its notes say why (a bed hidden by the house, say), and flagged otherwise, since the Yard photo is the one screen whose point is showing where things are.
 */
export function checkReport(plants: Plant[], rules: Rule[]): { lines: string[]; problems: number } {
	const lines: string[] = [];
	let problems = 0;

	for (const plant of plants) {
		const reach = previewReach(plant, rules);
		const reachedBy = reach.rules.length === 0 ? 'no Rule' : reach.rules.map(rule => rule.id).join(', ');
		lines.push(`${plant.id}${plant.species === null ? '' : ` (${plant.species})`}  [${plant.status}]  ${plant.tags.join(', ') || '(no tags)'}  →  ${reachedBy}`);

		if (plant.status === 'planted' && plant.position === null && plant.notes === null) {
			lines.push(`  ! no Pin and no note saying why. Run \`pnpm site-plants --only ${plant.id}\`, or add a note`);
			problems += 1;
		}
	}

	for (const problem of findUnmatchedPlantTags(plants, rules)) {
		lines.push(`! ${problem}`);
		problems += 1;
	}

	return { lines, problems };
}

async function askFor<T>(question: () => Promise<string>, read: (answer: string) => T | undefined): Promise<T> {
	for (;;) {
		const value = read(await question());
		if (value !== undefined) {
			return value;
		}
		console.log('    that isn\'t one of the choices');
	}
}

/**
 * Reads answers from a line iterator rather than readline's `question()`, which drops a line that arrives before it is asked for. Answers pasted or piped in all at once would otherwise vanish and leave the prompt waiting on a closed stream.
 */
function asker(): { question: (prompt: string) => Promise<string>; close: () => void } {
	const lines = createInterface({ input: process.stdin, terminal: false });
	const next = lines[Symbol.asyncIterator]();

	return {
		async question(prompt) {
			process.stdout.write(prompt);
			const line = await next.next();
			if (line.done === true) {
				throw new Error('input ended before every question was answered; nothing written');
			}
			return line.value;
		},
		close: () => lines.close(),
	};
}

async function add(plantsPath: string): Promise<void> {
	const source = readFileSync(plantsPath, 'utf8');
	const plants = parseWith(z.array(plantSchema), path.basename(plantsPath))(JSON.parse(source));
	const vocabulary = authoringVocabulary(plants, seedRules);
	const ask = asker();

	try {
		const name = await askFor(() => ask.question('\n  Name: '), answer => answer.trim() || undefined);
		const species = (await ask.question('  Species, the botanical name (Enter if unsure): ')).trim() || null;
		const kind = await askFor(() => ask.question('  Kind, [p]lant [c]ontainer [b]ed [l]awn: '), answer => pickOne(answer, plantSchema.shape.kind.options));
		const status = await askFor(() => ask.question('  In the ground yet? [p]lanted, or [n]ot yet: '), parseStatus);

		console.log('\n  Tags already in use (Rules select Plants by tag):');
		for (const entry of vocabulary.tags) {
			const selectedBy = entry.ruleIds.length === 0 ? '' : `  · selected by ${entry.ruleIds.join(', ')}`;
			console.log(`    ${entry.tag}  (${entry.plants} ${entry.plants === 1 ? 'Plant' : 'Plants'})${selectedBy}`);
		}
		const tags = parseTags(await ask.question('  Tags, comma separated: '));

		console.log('\n  Sites already written:');
		vocabulary.sites.forEach((site, index) => console.log(`    ${index + 1}. ${site}`));
		const site = pickOrType(await ask.question('  Site: a number, new text, or Enter to skip: '), vocabulary.sites);

		const lawn = kind !== 'lawn'
			? null
			: {
					grass: await ask.question('  Grass: '),
					areaSqFt: Number(await ask.question('  Area in square feet: ')),
					soil: await ask.question('  Soil: '),
					irrigation: { schedule: await ask.question('  Irrigation schedule: '), source: 'asserted' as const },
				};
		const notes = (await ask.question('  Notes, or Enter to skip: ')).trim() || null;

		const draft = parseWith(plantDraftSchema, 'the new Plant')({ name, species, kind, status, tags, site, lawn, notes });
		const taken = [...plants.map(p => p.id), ...seedRules.map(rule => rule.id), ...seedOccurrences.map(occurrence => occurrence.id)];
		const plant = draftToPlant(draft, taken);

		console.log(`\n  id: ${plant.id}  (permanent: history is kept under it)`);
		console.log(`  ${describeReach(previewReach(plant, seedRules)).replaceAll('\n', '\n  ')}`);

		if ((await ask.question('\n  Add it? [y/N] ')).trim().toLowerCase() !== 'y') {
			console.log('  nothing written\n');
			return;
		}

		writeFileSync(plantsPath, insertPlant(source, plant));
		console.log(`  added ${plant.id} to ${path.relative(ROOT, plantsPath)}`);

		if (plantsPath === DEFAULT_PLANTS && (await ask.question('  Place its Pin on the photo now? [y/N] ')).trim().toLowerCase() === 'y') {
			ask.close();
			spawnSync('pnpm', ['site-plants', '--only', plant.id], { cwd: ROOT, stdio: 'inherit' });
		}
		else {
			console.log(`  place its Pin later with \`pnpm site-plants --only ${plant.id}\`\n`);
		}
	}
	finally {
		ask.close();
	}
}

function check(plantsPath: string): void {
	const plants = parseWith(z.array(plantSchema), path.basename(plantsPath))(JSON.parse(readFileSync(plantsPath, 'utf8')));
	const { lines, problems } = checkReport(plants, seedRules);

	console.log(`\n${lines.join('\n')}\n\n${plants.length} Plants, ${problems === 0 ? 'nothing to fix' : `${problems} to look at`}\n`);
	process.exitCode = problems === 0 ? 0 : 1;
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));

	if (args.command === 'add') {
		await add(args.plants);
	}
	else {
		check(args.plants);
	}
}

// Only when run directly, so the pure functions above stay importable by a spec.
if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
	// A person reads this at a prompt, so a refusal prints as one line and not as a stack.
	await main().catch((error: unknown) => {
		console.error(`\n  ${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
