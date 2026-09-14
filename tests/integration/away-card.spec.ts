import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The card's path is the slug and nothing else, and the slug only exists in the
 * build environment (docs/adr/0004-coordinates-never-enter-the-repository.md).
 * Absent and blank are the same failure here, which is how
 * `src/app/away/[slug]/page.tsx` and `src/weather/location.ts` already treat
 * it. Throwing beats skipping: a spec that quietly skips itself is a spec that
 * stops covering the route the week somebody forgets the variable.
 */
const slug = process.env.ROOTSTOCK_AWAY_SLUG;
if (slug === undefined || slug.trim() === '') {
	throw new Error(`ROOTSTOCK_AWAY_SLUG is not set. playwright.config.ts loads .env.local when it is missing from the environment, so set it in one place or the other before running the end-to-end suite.`);
}

/** Only the fields this spec reads; `src/artifact/` owns the full shape. */
interface CommittedTask {
	id: string;
	title: string;
	status: string;
	delegable: boolean;
}

interface CommittedArtifact {
	generatedAt: string;
	plan: { tasks: CommittedTask[] };
	narration: { tasks: { taskId: string; text: string }[] } | null;
}

/**
 * Derived from the committed file rather than written down here, for the same
 * reason `generatedAt` is: `scripts/daily-run.sh` overwrites `artifact.json`
 * the first time it runs for real, and a list of titles pinned in this file
 * would go stale without going red.
 */
const artifact = JSON.parse(
	readFileSync(join(import.meta.dirname, '..', '..', 'data', 'artifact.json'), 'utf8'),
) as CommittedArtifact;

/**
 * What the card actually prints for one Task, mirroring `taskText` in
 * `src/components/away/away-card.tsx`. Narration is null in the committed
 * Artifact today, which makes this the title; resolving it the same way the
 * card does means a narrated Artifact does not turn a working card into a red
 * spec.
 */
function cardText(task: CommittedTask): string {
	return artifact.narration?.tasks.find(entry => entry.taskId === task.id)?.text ?? task.title;
}

const fired = artifact.plan.tasks.filter(task => task.status === 'fired');
const handedOver = fired.filter(task => task.delegable);
const withheld = fired.filter(task => !task.delegable);

/**
 * The card renders the same whether or not anyone is travelling, which is what
 * makes a discovered link harmless (CONTEXT.md's Away Card entry, ADR 0004).
 * One of these words on the page would undo that by itself.
 */
const TRAVEL_WORDS = /\b(?:travel(?:l?ing)?|trip|vacation|holiday|out of town|while (?:we|i)(?:'re| are)? away|back on)\b/i;

/**
 * Fresh on purpose, in both tests. The staleness banner is the only thing on
 * this route that ever prints a date, so pinning it silent leaves whatever the
 * card itself renders—which ADR 0004 says is nothing—and keeps the axe scan
 * off a band that `staleness.spec.ts` already covers.
 */
const FRESH = new Date(Date.parse(artifact.generatedAt) + 12 * 60 * 60 * 1000);

/**
 * Resolves once React has taken the page over.
 *
 * Duplicated from `staleness.spec.ts` rather than shared, because #16's file
 * list names the spec files and no helper beside them; the shared version is a
 * follow-up. Both absence assertions below need it for the reason that file
 * spells out: this route is a client component prerendered to static HTML, so
 * its heading is in the exported file whether or not the bundle ever ran. An
 * absence checked against that HTML is an absence of JavaScript rather than an
 * absence of dates, and the axe scan would be reading markup no visitor sees.
 */
async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => {
		const main = document.querySelector('main');

		return main !== null && Object.keys(main).some(key => key.startsWith('__reactFiber$'));
	});
}

test('hands over the delegable work and withholds the rest', async ({ page }) => {
	await page.clock.setFixedTime(FRESH);
	const response = await page.goto(`away/${slug}`);
	// Asserted because `dynamicParams = false` means a wrong slug is a 404 rather
	// than a rendered page, and a 404 body has no h1 to fail on either. Without
	// this the whole suite would read as "the card rendered nothing" when what
	// actually happened is that the build never knew about this slug.
	expect(response?.status()).toBe(200);

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Yard tasks this week');

	// A Task reaches this card only when it is fired and the Planner stamped
	// `delegable` on it; the view never string-matches a tag. An Artifact with
	// nothing to hand over would make the withheld loop below vacuous—an empty
	// loop passes—so this half is what keeps the test honest, and it fails
	// loudly rather than silently when the list is empty.
	expect(handedOver.length).toBeGreaterThan(0);
	for (const task of handedOver) {
		await expect(page.getByText(cardText(task), { exact: true })).toBeVisible();
	}

	// The committed Artifact withholds the fall pre-emergent, which is chemical
	// and so undelegable however its Rule's own field reads.
	//
	// `cardText` on this half too, not `task.title`. The card prints narration
	// text when it has some, so once `daily-run.sh` publishes a narrated Artifact
	// a leaked chemical Task would render under its narration text and an
	// assertion against the title alone would keep passing.
	for (const task of withheld) {
		await expect(page.getByText(cardText(task), { exact: true })).toHaveCount(0);
	}
});

test('names only its own generation date and says nothing about anyone being away', async ({ page }) => {
	await page.clock.setFixedTime(FRESH);
	await page.goto(`away/${slug}`);
	await waitForHydration(page);

	// Exactly one <time>: the card's own always-on generation line. #63 added
	// it; StalenessBanner stays silent in the fresh band this spec pins, so it
	// contributes none of its own.
	const time = page.locator('time');
	await expect(time).toHaveCount(1);
	await expect(time).toHaveAttribute('datetime', artifact.generatedAt);

	await expect(page.locator('body')).not.toContainText(TRAVEL_WORDS);
});

test('away card has no accessibility violations', async ({ page }) => {
	await page.clock.setFixedTime(FRESH);
	await page.goto(`away/${slug}`);
	await waitForHydration(page);

	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
