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
 * PDF, not by eye in a print preview. `page.pdf()` drives Chromium's actual
 * print pipeline rather than the on-screen preview overlay, which is the
 * distinction that sentence draws—so this is the one spec in the suite that
 * calls it. Only headless Chromium implements it, so every other project
 * skips rather than fails.
 */
test('renders the printable route to a real PDF without error', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'page.pdf() is only implemented in headless Chromium');

	const response = await page.goto(`away/${slug}`);
	expect(response?.status()).toBe(200);

	await page.emulateMedia({ media: 'print' });
	const pdf = await page.pdf({ format: 'Letter' });

	// A blank or truncated page would still satisfy a bare "did not throw", so
	// the byte count is the floor that catches a print pipeline that rendered
	// nothing.
	expect(pdf.length).toBeGreaterThan(1000);
});
