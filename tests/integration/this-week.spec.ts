import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Whether the page shows an Advisory depends on the day's model run, so the
 * expected count comes from the committed Artifact, the same file
 * `away-card.spec.ts` reads. The narration carried one Advisory through
 * 2026-09-22 and none from the 23rd, and a hardcoded count failed CI on a page
 * with nothing wrong.
 */
const artifact = JSON.parse(
	readFileSync(join(import.meta.dirname, '..', '..', 'data', 'artifact.json'), 'utf8'),
) as { narration: { advisories: unknown[] } | null };
const advisoryCount = artifact.narration?.advisories.length ?? 0;

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

		const purpose = page.getByText(/ for one yard in /);
		await expect(purpose).toContainText(/rule/i);
		await expect(purpose).toContainText(/evidence/i);

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
	//
	// It used to be met by opening one disclosure on load. It is now met by every
	// Task rendering its Citation as a line of its own, so the count is tasks to
	// citations one for one rather than three to one, and nothing has to be opened
	// on the reader's behalf for the page to show its work.
	test('shows a citation on every Task without anyone clicking a chevron', async ({ page }) => {
		await page.goto('');

		// Nothing is opened for the reader. The evidence does not depend on it.
		await expect(page.locator('main details[open]')).toHaveCount(0);

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
			await expect(tasks.nth(index).getByText('Rule and evidence')).toHaveCount(1);

			// And the dated evidence itself, rendered, not promised. Every Citation
			// kind leads with the word that says which kind it is.
			await expect(
				tasks.nth(index).getByText(/^(Window|Observed run|Forecast|No earlier|\d+ days since) /),
			).toHaveCount(1);
		}
	});

	// A Task and an Advisory must never read as the same kind of thing: one was
	// derived from a Rule and carries a Citation, the other was noticed by the
	// model and carries none (CONTEXT.md). Nothing here sits on a raised surface
	// any more, so the separation is carried by the boundary a Task has and the
	// words the Advisory block says about itself.
	test('keeps a Task and an Advisory visibly different kinds of thing', async ({ page }) => {
		await page.goto('');

		const pageSurface = await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor);
		// A Task is the list item carrying a disclosure. Advisories now sit above the
		// work and are list items too, so the bare selector would grab one of those.
		const task = page.locator('main li').filter({ has: page.locator('details') }).first();
		const taskSurface = await task.evaluate(node => getComputedStyle(node).backgroundColor);

		// No card, no fill: a Task paints no surface of its own and lets the page's
		// ground show through. Engines disagree on how they report that, so both
		// honest answers pass and any third colour fails.
		expect([pageSurface, 'rgba(0, 0, 0, 0)', 'transparent']).toContain(taskSurface);

		// What identifies it is a boundary, per WCAG 1.4.11 and #62. The check runs
		// on the second Task rather than the first: the first row drops its own top
		// rule because the section's rule already sits directly above it, and two
		// hairlines stacked read as a thicker one.
		const tasks = page.locator('main li').filter({ has: page.locator('details') });
		expect(await tasks.count()).toBeGreaterThan(1);

		const taskBorder = await tasks.nth(1).evaluate(node => getComputedStyle(node).borderTopWidth);
		expect(Number.parseFloat(taskBorder)).toBeGreaterThan(0);

		// And the Advisory says in words that no Rule produced it, so a reader who
		// never notices a border still cannot mistake it for cited work. With no
		// Advisory, `Advisories` returns null and the disclaimer goes with it.
		// `advisories.spec.tsx` covers the populated case against a fixture, so
		// that check never waits on the day's run.
		await expect(page.getByText(/No rule produced these/)).toHaveCount(advisoryCount > 0 ? 1 : 0);
	});
});

test.describe('one-handed, at 390x844', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	// The tap target the critique measured at 16x16, for a control used
	// one-handed and outdoors. The sign-off cell is the target and the row is
	// not, so a thumb resting on the instruction writes nothing. The cell alone
	// has to clear 44 on both axes, the page's own standard.
	test('gives the sign-off box a cell-sized hit target, and the text none', async ({ page }) => {
		await page.goto('');

		const input = page.locator('main li input[type="checkbox"]').first();
		const box = await input.boundingBox();

		expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
		expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
		await expect(page.locator('main li label')).toHaveCount(0);
	});
});
