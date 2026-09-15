/*
 * Re-sites the Pins on the yard photo by clicking them, one Plant at a time.
 *
 * A Pin is stored as fractions of the photo's width and height, which is what
 * lets the photo be replaced at another size without moving every marker
 * (CONTEXT.md, Pin). Those fractions were first entered by hand, and a number
 * typed from an estimate is exactly the kind of thing nobody notices is wrong.
 * This opens the real photo in a real browser, asks for each Plant in turn, and
 * writes back what was clicked.
 *
 * It is a script rather than a mode inside the app, for two reasons. The site is
 * a static export with no server runtime, so there is nowhere in the app that
 * could write a file; and the export is published, so an editing affordance
 * shipped inside it would be reachable by anyone who found the URL.
 *
 * Nothing here touches a coordinate. ADR 0004 keeps the property's location out
 * of the repository, and a fraction of an image is not a position on the earth:
 * CONTEXT.md's Pin entry says so, and `no-coordinates.spec.ts` enforces it by
 * name. The values written here are the same ones plants.json already carries.
 *
 * That ADR is also enforced on the values, which is why `roundFraction` below
 * rounds as hard as it does.
 *
 * The split is the one `generate.ts` and `schedule.ts` use: everything above
 * `main` is a pure function of its arguments, and `main` is the only code that
 * opens a browser, reads the filesystem or writes to it.
 */
import type { Browser } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLANTS = path.join(ROOT, 'src/seed/plants.json');
const YARD = path.join(ROOT, 'src/seed/yard.json');

/**
 * Two decimal places, because ADR 0004 is enforced on the values and not only on
 * the field names.
 *
 * `findLongDecimals` fails the seed if any number in plants.json carries three
 * or more decimals, on the reasoning that a long decimal pair is the shape a
 * coordinate pasted out of a maps app takes. A Pin is a fraction of an image and
 * not a position on the earth, but the guard cannot tell those apart by looking,
 * and a rule that has to inspect intent is no rule. So the fractions round to
 * the precision the guard allows.
 *
 * On the committed 1619px photo that is about 16px, which is smaller than the
 * callout it places. The first draft of this rounded to four decimals for the
 * sake of a clean diff and tripped the guard on the first run.
 */
function roundFraction(value: number): number {
	return Math.round(value * 100) / 100;
}

export interface Siting {
	id: string;
	position: { x: number; y: number } | null;
}

/**
 * Applies sitings to the plants file as text rather than through a parse and a
 * re-serialise.
 *
 * `plants.json` is hand-maintained seed data and the documented add-a-plant path
 * for this release, so its formatting is part of what a reader works with.
 * Round-tripping it through JSON.stringify would reflow every record in the file
 * to make one number move, and the diff would hide the change it was supposed to
 * show.
 */
export function applySitings(source: string, sitings: Siting[]): string {
	let updated = source;

	for (const { id, position } of sitings) {
		const idAnchor = `"id": "${id}"`;
		const start = updated.indexOf(idAnchor);

		if (start === -1) {
			throw new Error(`no Plant with id '${id}' in plants.json`);
		}

		const positionKey = updated.indexOf('"position":', start);

		if (positionKey === -1) {
			throw new Error(`Plant '${id}' has no position field to write to`);
		}

		const lineEnd = updated.indexOf('\n', positionKey);
		const line = updated.slice(positionKey, lineEnd);
		const trailingComma = line.trimEnd().endsWith(',') ? ',' : '';
		const next = position === null
			? `"position": null${trailingComma}`
			: `"position": { "x": ${position.x}, "y": ${position.y} }${trailingComma}`;

		updated = updated.slice(0, positionKey) + next + updated.slice(lineEnd);
	}

	return updated;
}

/** The page the siting session runs in: the photo at its own aspect, with every Pin drawn on it. */
export function sitingPage(photoDataUrl: string, plants: { id: string; name: string; position: { x: number; y: number } | null }[]): string {
	const pins = plants
		.filter(plant => plant.position !== null)
		.map((plant, index) => `<i data-id="${plant.id}" style="left:${(plant.position?.x ?? 0) * 100}%;top:${(plant.position?.y ?? 0) * 100}%">${index + 1}</i>`)
		.join('');

	return `<!doctype html><meta charset="utf-8"><style>
		html,body{margin:0;background:#14120f;font:14px/1.4 ui-monospace,monospace;color:#f2efe6}
		#wrap{position:relative;width:100vw;max-width:100vw}
		img{display:block;width:100%}
		i{position:absolute;transform:translate(-50%,-50%);display:grid;place-items:center;
			width:22px;height:22px;border:2px solid #fff;background:#fff;color:#111;
			font-style:normal;font-weight:700;font-size:11px}
		i.pending{background:transparent;color:#fff;border-style:dashed}
		#bar{position:fixed;left:0;right:0;bottom:0;padding:10px 14px;background:#b02a1f;color:#fff;font-weight:700}
	</style>
	<div id="wrap"><img src="${photoDataUrl}" alt="">${pins}</div>
	<div id="bar">Waiting…</div>
	<script>
		window.__clicks = [];
		document.getElementById('wrap').addEventListener('click', event => {
			const box = event.currentTarget.getBoundingClientRect();
			window.__clicks.push({
				x: (event.clientX - box.left) / box.width,
				y: (event.clientY - box.top) / box.height,
			});
		});
		window.__say = text => { document.getElementById('bar').textContent = text; };
		window.__mark = (id, x, y) => {
			const existing = document.querySelector('i[data-id="' + id + '"]');
			const pin = existing ?? document.createElement('i');
			pin.dataset.id = id;
			pin.style.left = (x * 100) + '%';
			pin.style.top = (y * 100) + '%';
			if (!existing) { document.getElementById('wrap').append(pin); }
		};
	</script>`;
}

async function siteEach(
	browser: Browser,
	photoDataUrl: string,
	plants: { id: string; name: string; position: { x: number; y: number } | null }[],
): Promise<Siting[]> {
	const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
	await page.setContent(sitingPage(photoDataUrl, plants));

	const ask = createInterface({ input: process.stdin, output: process.stdout });
	const sitings: Siting[] = [];

	for (const plant of plants) {
		const had = plant.position === null ? 'not sited yet' : `now at ${plant.position.x}, ${plant.position.y}`;
		await page.evaluate(text => window.__say(text), `Click where ${plant.name} belongs`);

		// Enter skips, so a Plant whose Pin is already right costs one keystroke.
		const answer = await ask.question(`\n  ${plant.name}  (${had})\n  click the photo, then press Enter · [s]kip · [c]lear · [q]uit: `);

		if (answer.trim().toLowerCase() === 'q') {
			break;
		}

		if (answer.trim().toLowerCase() === 'c') {
			sitings.push({ id: plant.id, position: null });
			console.log('    cleared');
			continue;
		}

		const clicks = await page.evaluate(() => window.__clicks.splice(0));
		const last = clicks.at(-1);

		if (answer.trim().toLowerCase() === 's' || last === undefined) {
			console.log('    left as it was');
			continue;
		}

		const position = { x: roundFraction(last.x), y: roundFraction(last.y) };
		await page.evaluate(([id, x, y]) => window.__mark(id as string, x as number, y as number), [plant.id, position.x, position.y]);
		sitings.push({ id: plant.id, position });
		console.log(`    sited at ${position.x}, ${position.y}`);
	}

	ask.close();
	await page.close();

	return sitings;
}

async function main(): Promise<void> {
	const plantsSource = readFileSync(PLANTS, 'utf8');
	const plants = JSON.parse(plantsSource) as { id: string; name: string; position: { x: number; y: number } | null }[];
	const yard = JSON.parse(readFileSync(YARD, 'utf8')) as { photo: { path: string } | null };

	if (yard.photo === null) {
		throw new Error('this yard has no photo, so there is nothing to site against');
	}

	// Inlined rather than served, so the session needs no dev server and reads the
	// same file the built site ships.
	const photoPath = path.join(ROOT, 'public', yard.photo.path.replace(/^\//, ''));
	const photoDataUrl = `data:image/jpeg;base64,${readFileSync(photoPath).toString('base64')}`;

	console.log(`\n  ${plants.length} Plants. The browser window shows the photo with every Pin on it.\n`);

	const browser = await chromium.launch({ headless: false });

	try {
		const sitings = await siteEach(browser, photoDataUrl, plants);

		if (sitings.length === 0) {
			console.log('\n  nothing changed\n');
			return;
		}

		writeFileSync(PLANTS, applySitings(plantsSource, sitings));
		console.log(`\n  wrote ${sitings.length} ${sitings.length === 1 ? 'Pin' : 'Pins'} to src/seed/plants.json`);
		console.log('  run `pnpm test` to check them against the schema\n');
	}
	finally {
		await browser.close();
	}
}

declare global {
	interface Window {
		__clicks: { x: number; y: number }[];
		__say: (text: string) => void;
		__mark: (id: string, x: number, y: number) => void;
	}
}

// Only when run directly, so the pure functions above stay importable by a spec.
if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
	await main();
}
