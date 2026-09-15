import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { NARRATOR_BRIEF } from '../../src/generation/narrator-brief';

test('serves the about route', async ({ page }) => {
	const response = await page.goto('about');
	expect(response?.status()).toBe(200);

	await expect(page.getByRole('banner')).toContainText('rootstock');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nothing here was invented');
});

test('shows the instruction the Narrator is actually handed', async ({ page }) => {
	await page.goto('about');

	// The page's claim is that nothing on it was written for it, and the brief is
	// the one part a reader has no other way to check. Asserting the rendered text
	// against the same constant `buildPrompt` sends is what stops the page drifting
	// into a paraphrase of the prompt while still looking quoted.
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
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nothing here was invented');
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
