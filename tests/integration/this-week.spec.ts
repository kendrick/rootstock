import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * This file absorbed `smoke.spec.ts`. Both of its assertions live below, and the
 * route they covered now has a name of its own, so the next spec about This Week
 * lands here instead of accreting onto a file called smoke.
 */

test('serves the home page', async ({ page }) => {
	// Relative, because `baseURL` already carries the `/rootstock` basePath. A
	// leading slash would resolve against the origin root and 404, and the
	// failure would read as a broken build rather than a wrong URL.
	const response = await page.goto('');
	// `pnpm build` writes `out/index.html` flat, and `serve` resolves the clean
	// URL onto it. Asserting the status stops a 404 page from reading downstream
	// as a route that rendered nothing.
	expect(response?.status()).toBe(200);

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
	await page.goto('');
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
