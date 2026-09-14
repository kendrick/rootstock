import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The pin's accessible name, which is the Plant's name and nothing else. The
 * list row for the same Plant is also a button, and its name picks up the kind
 * and site printed underneath, so only an exact match tells the two paths into
 * the sheet apart. The count assertion below is what keeps that claim from
 * rotting the day a row's wording changes.
 */
const PIN_NAME = 'Front lawn';

test('serves the yard route', async ({ page }) => {
	const response = await page.goto('yard');
	// `out/yard.html`, never `out/yard/index.html`: the export is flat and
	// serve's clean-URL default is what resolves one onto the other. A merged PR
	// body in this repo claims the nested shape, so the status is worth stating.
	expect(response?.status()).toBe(200);

	await expect(page.getByRole('banner')).toContainText('rootstock');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Yard');
});

/*
 * The regression this whole ticket started from. The exported page emitted
 * `src="/yard.jpg"`, which 404s against a project page served at
 * `/rootstock/`. `img.naturalWidth` sat at 0 and the browser raised no
 * console error over it, which is the reason nothing caught it the first
 * time. A vitest render of the component can't reproduce any of that: it
 * never goes through `next build`'s basePath rewriting or an actual network
 * fetch, so only a test against the built, served export can tell a correct
 * path from a broken one here.
 */
test('the yard photo loads from the built export', async ({ page }) => {
	await page.goto('yard');

	const photo = page.getByRole('img', { name: /seen from above/ });
	await expect(photo).toBeVisible();

	// An <img> reserves its box and reports visible the moment it's in the DOM,
	// well before the bytes behind a 404'd src would have failed to arrive.
	// naturalWidth is the one signal that the fetch actually resolved to image
	// data, so this polls it rather than reading it once right after goto.
	await expect(async () => {
		const naturalWidth = await photo.evaluate((image: HTMLImageElement) => image.naturalWidth);
		expect(naturalWidth).toBeGreaterThan(0);
	}).toPass();
});

test('a photo pin takes focus and opens its sheet on Enter', async ({ page }) => {
	await page.goto('yard');

	const pin = page.getByRole('button', { name: PIN_NAME, exact: true });
	await expect(pin).toHaveCount(1);

	await pin.focus();
	await expect(pin).toBeFocused();

	// Enter and not a click. A pin has to be a real button for a keyboard to
	// reach the photo at all, and a click would pass just as well on a div with
	// an onClick hung off it.
	//
	// Retried rather than pressed once, because the export ships HTML that
	// exists before React has attached anything to it. A single keypress that
	// lands in that gap goes nowhere and the sheet never opens.
	const sheet = page.getByRole('dialog');
	await expect(async () => {
		await pin.press('Enter');
		await expect(sheet).toBeVisible({ timeout: 1_000 });
	}).toPass();

	await expect(sheet.getByRole('heading', { name: PIN_NAME })).toBeVisible();
});

// This route has never had committed end-to-end coverage, so nothing here is a
// regression check: it is the first run that anybody can repeat.
test('yard route has no accessibility violations', async ({ page }) => {
	await page.goto('yard');
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
