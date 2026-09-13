import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Only the two fields this spec reads. The schemas that own the full shape live under `src/artifact/`. */
interface CommittedArtifact {
	generatedAt: string;
}

interface CommittedStatus {
	consecutiveFailures: number;
}

function readCommitted<T>(name: string): T {
	return JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'data', name), 'utf8')) as T;
}

/**
 * Read rather than written down here. The committed `generatedAt` already sits
 * in the stale band against the real clock, it crosses into expired within
 * days, and `scripts/daily-run.sh` overwrites the file the first time it runs
 * for real. A literal instant in this file is a time bomb with a fuse nobody
 * can see.
 */
const artifact = readCommitted<CommittedArtifact>('artifact.json');
const status = readCommitted<CommittedStatus>('status.json');

const HOUR = 60 * 60 * 1000;
const generatedAt = Date.parse(artifact.generatedAt);

/**
 * Offsets from the Artifact's own generation time, not instants. The bands come
 * from `src/artifact/staleness.ts`—fresh below 36 hours, stale out to 7 days,
 * expired past that—and each offset sits well inside its band, so a boundary
 * that moves fails the assertion it belongs to instead of a neighbour's.
 */
const FRESH = new Date(generatedAt + 12 * HOUR);
const STALE = new Date(generatedAt + 3 * 24 * HOUR);
const EXPIRED = new Date(generatedAt + 10 * 24 * HOUR);

/**
 * Resolves once React has taken the page over.
 *
 * Only the fresh case needs this, and it needs it badly: the banner renders
 * nothing until its mount effect fires, so an absence checked before hydration
 * is an absence of JavaScript rather than an absence of news, and the test
 * would pass on a build whose bundle never loaded. React stamps a
 * `__reactFiber$…` property onto every host node it hydrates, which is the
 * cheapest signal in reach that the client actually ran. The stale and expired
 * cases wait for an element instead and get the same guarantee for free.
 */
async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => {
		const main = document.querySelector('main');

		return main !== null && Object.keys(main).some(key => key.startsWith('__reactFiber$'));
	});
}

/**
 * Every band is pinned, fresh included, and the clock is installed before the
 * navigation. `setFixedTime` freezes `Date` while leaving timers running, which
 * is exactly what the banner needs: it renders nothing until a mount effect
 * fires, and a clock that stopped the event loop would stop that too.
 */

test('the banner dates the Plan once the Artifact is stale', async ({ page }) => {
	await page.clock.setFixedTime(STALE);
	await page.goto('');

	const banner = page.getByRole('status');
	await expect(banner).toBeVisible();
	await expect(banner).toContainText('This plan is from');
	// The machine-readable half, checked against the file rather than against a
	// formatted string, so a change to the visitor-facing wording does not have
	// to be mirrored here.
	await expect(banner.locator('time')).toHaveAttribute('datetime', artifact.generatedAt);
});

test('the banner sends the reader outside once the Artifact expires', async ({ page }) => {
	await page.clock.setFixedTime(EXPIRED);
	await page.goto('');

	const banner = page.getByRole('status');
	await expect(banner).toBeVisible();
	await expect(banner).toContainText('more than a week ago');
});

test('the banner stays silent while the Artifact is fresh', async ({ page }) => {
	// The banner goes quiet only when the data is fresh AND the runner is
	// healthy, so absence is the right assertion here only for as long as the
	// committed count is 0. Asserted rather than assumed: a status record with
	// failures on it puts the banner back on a perfectly current Artifact, and
	// this test would then be passing for a reason it never checked.
	expect(status.consecutiveFailures).toBe(0);

	await page.clock.setFixedTime(FRESH);
	await page.goto('');
	await waitForHydration(page);

	await expect(page.getByRole('status')).toHaveCount(0);
});

test('the expired banner has no accessibility violations', async ({ page }) => {
	// Expired is the band worth scanning. It is the only one that swaps in the
	// destructive palette and mutes the Task list underneath it, so it is the
	// only render on this route axe has not already seen.
	await page.clock.setFixedTime(EXPIRED);
	await page.goto('');
	await expect(page.getByRole('status')).toBeVisible();

	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
