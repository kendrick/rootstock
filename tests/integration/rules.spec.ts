import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('serves the rules route', async ({ page }) => {
	const response = await page.goto('rules');
	// `out/rules.html` flat, resolved from the clean URL by serve. Same reason
	// as the yard route: the nested shape is written down somewhere and wrong.
	expect(response?.status()).toBe(200);

	await expect(page.getByRole('banner')).toContainText('rootstock');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rules');
});

test('gives Guards their own labelled section', async ({ page }) => {
	await page.goto('rules');

	// A Guard creates no work. Grouping Guards behind a labelled landmark is
	// what lets a reader scanning for work stop before them, so the landmark and
	// its heading are the feature rather than markup detail.
	const guards = page.getByRole('region', { name: 'Guards' });
	await expect(guards).toBeVisible();
	await expect(guards.getByRole('heading', { level: 2 })).toHaveText('Guards');
});

test('rules route has no accessibility violations', async ({ page }) => {
	await page.goto('rules');
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
