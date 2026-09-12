import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'jsdom',
		globals: true,
		// Customize per project — these defaults are conservative.
		include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.spec.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx', 'scripts/**/*.spec.mjs'],
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
