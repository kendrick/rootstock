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

// What follows reads the browser, because jsdom showed none of it: the name
// Chromium computes, the width the status strip gets, and the page's scroll.

test('names each Rule heading with its kind, with no stray space', async ({ page }) => {
	await page.goto('rules');

	await expect(page.getByRole('heading', { level: 3, name: 'Fall pre-emergent, window rule', exact: true })).toBeVisible();
});

// #84: below lg the 40px kind column stacks the status a word per line, so the
// status spans the row instead.
test('runs each Rule\'s status across the whole row on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('rules');

	const rows = page.locator('main li');
	const count = await rows.count();
	expect(count).toBeGreaterThan(0);
	for (let index = 0; index < count; index++) {
		const row = await rows.nth(index).boundingBox();
		const status = await rows.nth(index).locator('> div:last-child').boundingBox();
		expect(status?.width).toBeCloseTo(row?.width ?? 0, 0);
	}
});

// WCAG 1.4.10: 390 CSS px at 200% zoom is a 195px viewport. An unrounded
// reading in a Threshold status once scrolled it sideways by 18px (#84).
test('reflows at 200% zoom without scrolling sideways', async ({ page }) => {
	await page.setViewportSize({ width: 195, height: 422 });
	await page.goto('rules');

	const [scrollWidth, clientWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
	expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

// DESIGN.md keeps stamp red for recorded work, and nothing on this page is
// ever recorded.
test('prints nothing in stamp red', async ({ page }) => {
	await page.goto('rules');

	const accent = await page.evaluate(() => {
		const probe = document.createElement('span');
		probe.className = 'text-accent';
		document.body.append(probe);
		const red = getComputedStyle(probe).color;
		probe.remove();
		return [...document.querySelectorAll('main *')].filter(element => getComputedStyle(element).color === red).map(element => element.textContent);
	});
	expect(accent).toEqual([]);
});

// The page lists the silent Rules under Waiting, so the margin doesn't.
test('leaves the margin\'s Not This Week list to the other routes', async ({ page }) => {
	await page.goto('rules');
	await expect(page.getByRole('heading', { level: 1, name: 'Rules' })).toBeVisible();
	await expect(page.getByText('Not this week', { exact: true })).toHaveCount(0);

	await page.goto('./');
	await expect(page.getByText('Not this week', { exact: true })).toHaveCount(1);
});
