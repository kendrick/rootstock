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

/*
 * #50's brief sentence, measured the way the critique measured it:
 *
 * > Above the fold in a desktop browser, This Week says what it is, this
 * > week's plan for one yard with the rule and the reading behind every line,
 * > before it says what to do.
 *
 * The sentence was written to be falsifiable and it did its job: at 1440x900
 * everything before the first task was `<h1>This Week` and `<h2>Ready now`,
 * and `details[open]` was 0 against three visible tasks. These tests are that
 * measurement kept, so the route cannot regress to it without a failure.
 *
 * The viewport is set through `test.use` rather than `page.setViewportSize`,
 * because the mobile projects build their context with `isMobile` and resizing
 * one after the fact is not supported everywhere. Set at creation it works on
 * every project in the matrix, which is the point: the brief names a desktop
 * width, so every browser is asked the desktop question.
 *
 * Every locator is scoped to `main`. The shell's nav renders `<li>` too, and a
 * bare `li` count would grade the page on its own navigation.
 */
test.describe('the brief sentence, at 1440x900', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('states its purpose above the fold, ahead of the first task', async ({ page }) => {
		await page.goto('');

		const purpose = page.getByText(/One yard in /);
		await expect(purpose).toContainText(/rule/i);
		await expect(purpose).toContainText(/reading/i);

		// Above the fold is a measurement, not a hope. The critique found the
		// whole route fitted inside 900px, so a purpose statement that scrolled
		// off would be one nobody read.
		const purposeBox = await purpose.boundingBox();
		expect(purposeBox).not.toBeNull();
		expect((purposeBox?.y ?? Number.POSITIVE_INFINITY) + (purposeBox?.height ?? 0)).toBeLessThan(900);

		// Before it says what to do.
		const taskBox = await page.locator('main li').first().boundingBox();
		expect(taskBox?.y ?? 0).toBeGreaterThan(purposeBox?.y ?? 0);
	});

	// Visible tasks against visible citations, which is the count the critique
	// ran and got 3 to 0 on. The property ADR 0001 calls the architecturally
	// interesting one has to be on the screen, not merely in the DOM.
	test('shows a citation without anyone clicking a chevron', async ({ page }) => {
		await page.goto('');

		await expect(page.locator('main details[open]')).toHaveCount(1);

		/*
		 * A label rather than a bare chevron, on every Task: the evidence says
		 * what it is whether or not it is open.
		 *
		 * A Task is a list item carrying a disclosure, and that is the honest
		 * separator rather than a trick to dodge the Advisory list. CONTEXT.md
		 * says an Advisory carries no Citation, so an Advisory `<li>` has
		 * nothing to disclose and correctly has no label either.
		 */
		const tasks = page.locator('main li').filter({ has: page.locator('details') });
		const count = await tasks.count();
		expect(count).toBeGreaterThan(0);

		for (let index = 0; index < count; index += 1) {
			await expect(tasks.nth(index).getByText('Rule and reading')).toHaveCount(1);
		}

		// The open one is showing real evidence rather than an empty panel.
		await expect(page.locator('main details[open]')).toContainText('Region');
	});

	// Confirms the inversion is righted rather than merely restyled: the Task
	// carries the raised surface the Advisory used to have.
	test('puts the Tasks on the raised surface and the Advisory off it', async ({ page }) => {
		await page.goto('');

		const surfaceOf = (selector: string) =>
			page.locator(selector).first().evaluate(node => getComputedStyle(node).backgroundColor);

		const pageSurface = await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor);

		expect(await surfaceOf('main li')).not.toBe(pageSurface);
		expect(await surfaceOf('main section:has(> div > h2:text("Also observed"))')).toBe('rgba(0, 0, 0, 0)');
	});
});

test.describe('one-handed, at 390x844', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	// The tap target the critique measured at 16x16, for a control used
	// one-handed and outdoors. 24px is WCAG 2.2's minimum on the short axis and
	// the number #62 asks for; the row spends 44 and brings the text with it.
	test('gives the check-off box a row-sized hit target', async ({ page }) => {
		await page.goto('');

		const label = page.locator('main li label').first();
		const box = await label.boundingBox();

		expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
		await expect(label.locator('input[type="checkbox"]')).toHaveCount(1);

		// The text beside the box is inside the target rather than dead space
		// next to it, which is what a `<label>` buys and `aria-labelledby` alone
		// did not.
		expect(box?.width ?? 0).toBeGreaterThan(200);
	});
});
