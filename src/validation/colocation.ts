import { existsSync, globSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

// Playwright drives the built site rather than importing a module, so its specs
// have no subject to sit beside and run under a different runner entirely.
//
// `.preview` is `out` a second time: `pnpm preview` copies the export there to
// serve it under the basePath, so whatever reason kept `out` off this list
// applies to a duplicate of it sitting beside it.
const IGNORED = ['node_modules', '.next', 'out', '.preview', 'dist', 'build', join('tests', 'integration')];

const SUBJECT_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js'];

/**
 * Finds spec files that do not sit beside the code they exercise.
 *
 * This project keeps a spec in the same directory as its subject, named for
 * it, so that opening a module shows you its tests without a hunt through a
 * parallel tree. A convention written only in prose drifts: the rule was
 * documented and broken inside the same day, by two different authors, which
 * is what this check exists to stop.
 *
 * A spec is placed correctly when a sibling file shares its basename—so
 * `rule.spec.ts` needs `rule.ts` next to it. The extension may differ, which
 * is how `generate-schema.spec.mjs` pairs with `generate-schema.ts`.
 *
 * A `.prerender` suffix is stripped before that lookup, so
 * `page.prerender.spec.ts` pairs with `page.tsx`. Such a spec re-runs the module
 * beside it under a server-side environment, so that module is its subject. The
 * exception map holds specs that span several modules, and a prerender spec
 * never does.
 */
export function findMisplacedSpecs(root: string, allowed: ReadonlySet<string> = new Set()): string[] {
	const specs = globSync('**/*.spec.{ts,tsx,mjs,js}', {
		cwd: root,
		exclude: name => IGNORED.some(prefix => name.startsWith(prefix)),
	});

	return specs
		.map(spec => relative(root, join(root, spec)))
		.filter(spec => !allowed.has(spec))
		.filter(spec => !hasSibling(root, spec))
		.sort();
}

function hasSibling(root: string, spec: string): boolean {
	const stem = spec.replace(/(?:\.prerender)?\.spec\.(?:ts|tsx|mjs|js)$/, '');
	return SUBJECT_EXTENSIONS.some(extension => existsSync(join(root, dirname(spec), `${basename(stem)}${extension}`)));
}

function basename(stem: string): string {
	const cut = stem.lastIndexOf('/');
	return cut === -1 ? stem : stem.slice(cut + 1);
}
