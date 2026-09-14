import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// tsconfig sets `jsx: 'preserve'` so the Next compiler owns the transform in
	// the app build, and Vite reads that same setting here—which leaves JSX
	// untransformed at the test boundary, where every `.spec.tsx` then dies at
	// parse. The fix belongs in this file rather than in tsconfig: changing it
	// there would take the transform away from Next and break the build.
	// `oxc` and not `esbuild`, because Vite 8 transforms through rolldown; the
	// `esbuild.jsx` spelling most guidance still names is accepted and ignored.
	oxc: { jsx: { runtime: 'automatic' } },
	test: {
		environment: 'jsdom',
		globals: true,
		// Specs live beside the code they exercise, so the globs follow the source
		// tree rather than a separate test root. `*.spec.ts` at the top level is for
		// config files, which have nowhere else to sit beside.
		include: ['*.spec.ts', 'src/**/*.spec.ts', 'src/**/*.spec.tsx', 'scripts/**/*.spec.mjs'],
		// `.preview` is the export copied under the basePath by `pnpm preview`, so
		// it is `out` twice over and belongs here for the same reason.
		exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/build/**', '**/out/**', '**/.preview/**'],
		// Uncomment if you have a setup file:
		// setupFiles: ['./tests/setup.ts'],
		// Coverage runs on every `pnpm test` so the number lands in front of
		// whoever ran the suite; behind a `--coverage` flag it would be read once.
		// No `thresholds` key, deliberately: a gate would fail a branch for
		// touching a file it had good reason to leave uncovered.
		//
		// The two exclusions below add to Vitest's own. Vitest 4 ships an empty
		// `coverage.exclude` and appends its hardcoded protections (node_modules,
		// config files, the test globs, setup files) after whatever is set here,
		// so spreading `coverageConfigDefaults.exclude` would spread an empty
		// array and read as though it guarded something.
		coverage: {
			enabled: true,
			provider: 'v8',
			// `json-summary` beside `text` so CI has a machine-readable figure to
			// pick up later without a second run.
			reporter: ['text', 'json-summary'],
			// `src/app/**` is routing and layout that the Playwright suite covers
			// end to end; `src/components/ui/**` is generated shadcn source this
			// repo does not author. Counting either dilutes the figure for the
			// code that does carry logic.
			//
			// `data/**` is in here because `load.ts` imports the committed JSON,
			// which drags it into the report at a free 100%. A data file has no
			// branch to miss and no function to leave untested, so scoring it at
			// all only moves the headline number up for nothing.
			exclude: ['src/app/**', 'src/components/ui/**', 'data/**'],
		},
	},
	resolve: {
		// Must match tsconfig's `"@/*": ["./src/*"]` and components.json, or the same
		// import specifier resolves to two different places in tests versus the app.
		// The scaffold's default pointed at the repo root, which typechecks fine and
		// fails only at test time, once something actually imports through the alias.
		alias: { '@': path.resolve(import.meta.dirname, './src') },
	},
});
