import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// tsconfig sets `jsx: 'preserve'` so the Next compiler owns the transform in
	// the app build, and Vite reads that same setting here — which leaves JSX
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
		exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/build/**', '**/out/**'],
		// Uncomment if you have a setup file:
		// setupFiles: ['./tests/setup.ts'],
	},
	resolve: {
		// Must match tsconfig's `"@/*": ["./src/*"]` and components.json, or the same
		// import specifier resolves to two different places in tests versus the app.
		// The scaffold's default pointed at the repo root, which typechecks fine and
		// fails only at test time, once something actually imports through the alias.
		alias: { '@': path.resolve(import.meta.dirname, './src') },
	},
});
