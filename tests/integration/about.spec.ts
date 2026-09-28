import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { NARRATOR_BRIEF } from '../../src/generation/narrator-brief';

/** Only the fields this spec checks. The schemas that own the full shape live under `src/artifact/`. */
interface CommittedArtifact {
	generatedAt: string;
	plan: { tasks: unknown[] };
}

test('serves the about route', async ({ page }) => {
	const response = await page.goto('about');
	expect(response?.status()).toBe(200);

	await expect(page.getByRole('banner')).toContainText('rootstock');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('How this works');

	// The footer and the New Here band both send a reader here as "How this
	// works", and the tab is how a reader tells this page from the others.
	await expect(page).toHaveTitle('How this works · rootstock');
});

test('shows the instruction the Narrator is actually handed', async ({ page }) => {
	await page.goto('about');

	// The page's claim is that nothing on it was written for it, and the brief is
	// the one part a reader has no other way to check. Asserting the rendered text
	// against the same constant `buildPrompt` sends is what stops the page drifting
	// into a paraphrase of the prompt while still looking quoted. It sits folded,
	// so the reader has to open it first.
	await page.getByText('The exact instruction it\'s given').click();
	for (const paragraph of NARRATOR_BRIEF) {
		await expect(page.getByText(paragraph, { exact: true })).toBeVisible();
	}
});

test('sends a first-time reader from the plan to the account of it', async ({ page }) => {
	await page.goto('.');

	// A reader arriving cold on This Week gets a list of chemical applications with
	// nothing saying where they came from. The band is the only thing on that page
	// addressed to them, so the link out of it is the feature.
	const band = page.getByRole('complementary', { name: 'New here' });
	await expect(band).toBeVisible();

	await band.getByRole('link', { name: 'How this works' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('How this works');
});

test('draws the specimen with the same column heads as the ticket', async ({ page }) => {
	// The specimen is only worth annotating if a reader recognizes it on This
	// Week afterwards. It draws its own heads, which drift from the ticket's
	// without anyone noticing, so this compares what the two pages render.
	const heads = async (): Promise<string | null> => page.locator('div[aria-hidden="true"]', { hasText: /sign off/i }).first().textContent();

	await page.goto('.');
	const ticket = await heads();

	await page.goto('about');
	expect(await heads()).toBe(ticket);
});

test('describes every route the nav offers', async ({ page }) => {
	await page.goto('about');

	// The page is the answer to "how do I use this", so a route added to the nav
	// without a row here is a question it stops answering.
	const nav = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
	const pages = page.locator('dl').filter({ hasText: 'Away Card' }).getByRole('link');
	const offered = await nav.evaluateAll(links => links.map(link => link.getAttribute('href')));
	const described = await pages.evaluateAll(links => links.map(link => link.getAttribute('href')));

	expect(offered.length).toBeGreaterThan(0);
	for (const href of offered) {
		expect(described).toContain(href);
	}
});

test('leaves the Rules nothing lit off the page that explains them', async ({ page }) => {
	await page.goto('about');

	// On a phone the margin's list lands after the page's last section and reads
	// as part of it.
	await expect(page.getByText('Not this week', { exact: true })).toHaveCount(0);
});

test('drops the band for good once it is dismissed', async ({ page }) => {
	await page.goto('.');

	const band = page.getByRole('complementary', { name: 'New here' });
	await band.getByRole('button', { name: 'Dismiss' }).click();
	await expect(band).toBeHidden();

	// The daily reader is the primary audience and owes a banner nothing, so the
	// dismissal has to survive the reload rather than lasting the session. It is
	// checked before paint, which is why this asserts a band that never appears
	// instead of one that appears and goes.
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(band).toBeHidden();
});

test('about route has no accessibility violations', async ({ page }) => {
	await page.goto('about');
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});

test('prints the committed run\'s own Task count and generation time under its steps', async ({ page }) => {
	// Read from the file the page was built from, and worked out by slicing the
	// ISO string rather than through Intl, so the page is checked against the
	// file and not against a second copy of its own formatter.
	const artifact = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'data', 'artifact.json'), 'utf8')) as CommittedArtifact;
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const [, month, day, hour, minute] = /^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u.exec(artifact.generatedAt) ?? [];
	const tasks = artifact.plan.tasks.length;

	await page.goto('about');

	const steps = page.locator('#day ~ ol').first().getByRole('listitem');
	await expect(steps.filter({ has: page.getByText('Plan the week', { exact: true }) })).toContainText(tasks === 0 ? 'No Tasks written' : `${tasks} ${tasks === 1 ? 'Task' : 'Tasks'} from`, { ignoreCase: true });
	await expect(steps.filter({ has: page.getByText('Publish', { exact: true }) })).toContainText(`${months[Number(month) - 1]} ${Number(day)}, ${hour}:${minute} UTC`, { ignoreCase: true });
});
