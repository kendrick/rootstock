import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
