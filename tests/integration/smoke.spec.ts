import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// basePath means the app is served at /rootstock, never at the origin root.
// Navigating to '/' here would 404 and the failure would read as a broken build
// rather than a wrong URL, so the path is spelled out.
const HOME = '/rootstock/';

test('serves the home page', async ({ page }) => {
	await page.goto(HOME);
	// Two assertions because two things have to have rendered: the shell around
	// the route, and the route inside it. The wordmark is plain text in the
	// banner rather than a heading, so that every route owns the only h1 on the
	// page and the axe scan below sees one heading order rather than two.
	await expect(page.getByRole('banner')).toContainText('rootstock');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('This Week');
});

// Accessibility is a gate from the first page rather than a cleanup pass later:
// the violations are cheapest to fix before there is a layout to unpick.
test('home page has no accessibility violations', async ({ page }) => {
	await page.goto(HOME);
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
