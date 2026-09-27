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

// The status is the one line the band changes, so it sits under the name and
// ahead of the record at every width.
for (const width of [390, 1440]) {
	test(`puts each Rule's status under its name at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('rules');

		const rows = page.locator('main li[id^="rule-"]');
		const count = await rows.count();
		expect(count).toBeGreaterThan(0);
		for (let index = 0; index < count; index++) {
			const row = rows.nth(index);
			const name = await row.locator('h3').boundingBox();
			const status = await row.locator('[data-rule-status]').boundingBox();
			const record = await row.locator('dl').boundingBox();
			expect(status!.y).toBeGreaterThanOrEqual(name!.y + name!.height - 1);
			expect(status!.y + status!.height).toBeLessThanOrEqual(record!.y + 1);
		}
	});
}

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

// Reflow means more than no sideways scroll: at 195px nothing inside a Rule's
// row may run past the row's own ruled edge.
test('keeps every line inside its row at 200% zoom', async ({ page }) => {
	await page.setViewportSize({ width: 195, height: 422 });
	await page.goto('rules');

	const overruns = await page.evaluate(() => [...document.querySelectorAll('main li[id^="rule-"]')].flatMap((row) => {
		const edge = row.getBoundingClientRect().right;
		const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
		const out: string[] = [];
		for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
			const range = document.createRange();
			range.selectNodeContents(node);
			const parent = node.parentElement;
			if (parent === null || parent.closest('.sr-only') !== null) {
				continue;
			}
			for (const rect of range.getClientRects()) {
				if (rect.right > edge + 0.5) {
					out.push(`${node.textContent?.trim()} ends ${Math.round(rect.right - edge)}px past its row`);
				}
			}
		}
		for (const icon of row.querySelectorAll('svg')) {
			if (icon.getBoundingClientRect().right > edge + 0.5) {
				out.push('an icon ends past its row');
			}
		}
		return out;
	}));
	expect(overruns).toEqual([]);
});

// The head holds the wordmark and the ticket number side by side until they
// don't fit, then stacks. At 195px, 390 at 200% zoom, they drew over each other.
for (const width of [195, 299, 300, 390]) {
	test(`keeps the wordmark and ticket number apart at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 600 });
		await page.goto('rules');

		const [mark, number] = await page.evaluate(() => [...document.querySelectorAll('header > *')].slice(0, 2).map((cell) => {
			const range = document.createRange();
			range.selectNodeContents(cell);
			const box = range.getBoundingClientRect();
			return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
		}));
		const overlaps = mark!.left < number!.right && number!.left < mark!.right && mark!.top < number!.bottom && number!.top < mark!.bottom;
		expect(overlaps).toBe(false);
	});
}
