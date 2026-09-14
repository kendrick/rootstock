import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** The seed Plant this file's pin- and list-based tests both open. */
const PIN_NAME = 'Front lawn';

/** Every seed Plant the photo sites a pin for, by its row's accessible name prefix (`plant-list.tsx` appends kind and site). */
const SITED_PLANT_NAMES = ['Front lawn', 'Brown Turkey fig', 'Esperanza', 'Watermelon Ruffles hardy hibiscus', 'Starry Night hardy hibiscus', 'Luna White hardy hibiscus'];

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

test('a photo pin opens its sheet on click', async ({ page }) => {
	await page.goto('yard');

	// title, not role: the pin is aria-hidden (see the dedup test below), so a
	// role query would not find it at all, exactly like a screen reader.
	const pin = page.locator(`button[title="${PIN_NAME}"]`);
	await expect(pin).toHaveCount(1);

	const sheet = page.getByRole('dialog');
	await pin.click();
	await expect(sheet).toBeVisible();
	await expect(sheet.getByRole('heading', { name: PIN_NAME })).toBeVisible();
});

// The critique found the pin layer and the list exposing the same nine Plants
// as two independent button sets: a keyboard or screen-reader user traversed
// every one of them twice with near-identical labels. The list row is the one
// surviving path, and this is the keyboard equivalent of the click test above.
test('a plant reaches its sheet by keyboard through the list, once', async ({ page }) => {
	await page.goto('yard');

	const row = page.getByRole('button', { name: new RegExp(`^${PIN_NAME}`) });
	await expect(row).toHaveCount(1);

	await row.focus();
	await expect(row).toBeFocused();

	const sheet = page.getByRole('dialog');
	await expect(async () => {
		await row.press('Enter');
		await expect(sheet).toBeVisible({ timeout: 1_000 });
	}).toPass();

	await expect(sheet.getByRole('heading', { name: PIN_NAME })).toBeVisible();
});

test('every sited Plant appears once in the accessible tab order, not twice', async ({ page }) => {
	await page.goto('yard');

	for (const name of SITED_PLANT_NAMES) {
		await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toHaveCount(1);
	}
});

// The critique's own method: elementFromPoint at a pin's centre returning a
// different pin. Three of six failed this at 390px before the fix.
test('no pin fails its own centre hit-test at 390px', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('yard');

	const pins = page.locator('button[title]');
	const count = await pins.count();
	expect(count).toBeGreaterThan(0);

	for (let i = 0; i < count; i++) {
		const pin = pins.nth(i);
		const title = await pin.getAttribute('title');
		const box = await pin.boundingBox();
		if (box === null) {
			throw new Error(`pin '${title}' has no bounding box: this test has nothing to hit-test.`);
		}

		const hitTitle = await page.evaluate(
			([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('title') ?? null,
			[box.x + box.width / 2, box.y + box.height / 2] as const,
		);

		expect(hitTitle, `pin '${title}' at its own centre resolved to '${hitTitle}' instead`).toBe(title);
	}
});

// This route has never had committed end-to-end coverage, so nothing here is a
// regression check: it is the first run that anybody can repeat.
test('yard route has no accessibility violations', async ({ page }) => {
	await page.goto('yard');
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
