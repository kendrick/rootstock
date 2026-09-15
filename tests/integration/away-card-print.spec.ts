import { expect, test } from '@playwright/test';

/**
 * The card's path is the slug and nothing else; see away-card.spec.ts for the
 * full reasoning. Duplicated rather than imported, because tests/integration
 * holds Playwright specs and not a shared module of its own.
 */
const slug = process.env.ROOTSTOCK_AWAY_SLUG;
if (slug === undefined || slug.trim() === '') {
	throw new Error(`ROOTSTOCK_AWAY_SLUG is not set. playwright.config.ts loads .env.local when it is missing from the environment, so set it in one place or the other before running the end-to-end suite.`);
}

/**
 * #63's acceptance criteria ask that print output be verified by rendering to
 * PDF, not by eye in a print preview. `page.emulateMedia({ media: 'print' })`
 * puts the page in the exact CSS state Chromium's print pipeline reads from,
 * so the assertions below are reading the same cascade the PDF is built out
 * of. A bare byte count would still pass on an invisible heading, a nav that
 * never hid, or a missing date, so this checks each of #63's specific claims
 * before treating a non-trivial PDF as proof of anything.
 *
 * #63 asked for the wordmark in ink, and the card no longer carries one: it is
 * the stub torn off the ticket and it brings its own sheet, so the shell's head
 * never renders here. What identifies the printed sheet is its own heading and
 * the date beneath it, and that is what has to survive the cascade.
 */
test('prints its heading in ink, hides the nav, and carries a date and a box to tick', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'page.pdf() is only implemented in headless Chromium');

	const response = await page.goto(`away/${slug}`);
	expect(response?.status()).toBe(200);
	await page.emulateMedia({ media: 'print' });

	await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(0, 0, 0)');
	await expect(page.locator('nav[aria-label="Main"]')).toBeHidden();
	await expect(page.getByRole('button', { name: /print/i })).toBeHidden();

	const time = page.locator('time');
	await expect(time).toBeVisible();
	await expect(time).toHaveCSS('color', 'rgb(0, 0, 0)');

	// One empty box per task line, drawn in the same ink as the text beside
	// it—see away-card.tsx's border-current comment for why the two never
	// drift apart.
	const boxes = page.locator('li span[aria-hidden="true"]');
	expect(await boxes.count()).toBeGreaterThan(0);
	await expect(boxes.first()).toHaveCSS('border-color', 'rgb(0, 0, 0)');

	await expect(page.getByText('The yard needs more this week than this page shows.')).toBeVisible();

	const pdf = await page.pdf({ format: 'Letter' });
	// A blank or truncated page would still satisfy a bare "did not throw", so
	// the byte count is a floor beneath the assertions above, not a
	// replacement for them.
	expect(pdf.length).toBeGreaterThan(1000);
});
