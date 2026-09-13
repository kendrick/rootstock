import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Each git worktree runs its own preview server, so a hardcoded 3000 would let
// two worktrees collide. E2E_PORT lets each one claim its own.
const port = Number(process.env.E2E_PORT ?? 3000);

// Next loads `.env.local` when it builds. The Playwright runner is a separate
// Node process that does not, so the slug the Away Card spec needs to build its
// URL gets loaded here, once, before any spec runs. An already-set value wins:
// CI has no `.env.local` and passes the slug through the workflow's `env:` block.
if (!process.env.ROOTSTOCK_AWAY_SLUG) {
	try {
		process.loadEnvFile(join(import.meta.dirname, '.env.local'));
	}
	catch {
		// No file is the CI case. A local run without the slug then fails inside
		// the one spec that needs it, which reads better than a crash out here.
	}
}

export default defineConfig({
	testDir: 'tests/integration',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		// basePath belongs in the baseURL so specs navigate by relative path
		// instead of repeating `/rootstock` in every goto.
		baseURL: `http://localhost:${port}/rootstock/`,
		trace: 'on-first-retry',
	},
	webServer: {
		// Serve the static export rather than the dev server. The export is what
		// actually ships, and dev behaves differently. `pretest:e2e` runs the build
		// first; a stale or missing out/ otherwise gives a misleading result.
		command: 'pnpm preview',
		port,
		// Opt-in rather than `!process.env.CI`: an orphaned dev server sitting on
		// 3000 would otherwise be adopted silently, and the suite would run against
		// `pnpm dev` instead of the export it is supposed to check. Set
		// E2E_REUSE_SERVER=1 for a run where reuse is actually wanted.
		reuseExistingServer: process.env.E2E_REUSE_SERVER === '1',
		timeout: 120_000,
	},
	// Mobile-first matrix. CI passes explicit --project flags to run only the
	// Chromium-based projects; WebKit and Firefox are local checks.
	projects: [
		{ name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
		{ name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
		{ name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
		{ name: 'desktop-firefox', use: { ...devices['Desktop Firefox'] } },
		{ name: 'desktop-safari', use: { ...devices['Desktop Safari'] } },
	],
});
