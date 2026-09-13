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

test('hands over the delegable work and withholds the rest', async ({ page }) => {
	await page.clock.setFixedTime(FRESH);
	const response = await page.goto(`away/${slug}`);
	// `out/away/<slug>.html`, written flat under the away directory.
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
	for (const task of withheld) {
		await expect(page.getByText(task.title, { exact: true })).toHaveCount(0);
	}
});

test('names no date and says nothing about anyone being away', async ({ page }) => {
	await page.clock.setFixedTime(FRESH);
	await page.goto(`away/${slug}`);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

	await expect(page.locator('time')).toHaveCount(0);
	await expect(page.locator('body')).not.toContainText(TRAVEL_WORDS);
});

test('away card has no accessibility violations', async ({ page }) => {
	await page.clock.setFixedTime(FRESH);
	await page.goto(`away/${slug}`);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
