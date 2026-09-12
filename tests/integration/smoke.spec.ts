import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// basePath means the app is served at /rootstock, never at the origin root.
// Navigating to '/' here would 404 and the failure would read as a broken build
// rather than a wrong URL, so the path is spelled out.
const HOME = '/rootstock/';

test('serves the home page', async ({ page }) => {
	await page.goto(HOME);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('rootstock');
});

// Accessibility is a gate from the first page rather than a cleanup pass later:
// the violations are cheapest to fix before there is a layout to unpick.
test('home page has no accessibility violations', async ({ page }) => {
	await page.goto(HOME);
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
