import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findMisplacedSpecs } from './colocation';

const REPO_ROOT = join(import.meta.dirname, '..', '..');

/**
 * Specs that exercise several modules at once and so belong beside none of
 * them. Every entry is a deliberate exception with a reason, which is the
 * point: adding one is a visible edit here rather than a file quietly landing
 * somewhere convenient.
 */
const CROSS_CUTTING = new Map([
	[
		join('src', 'validation', 'no-coordinates.spec.ts'),
		'Walks the Artifact, Plant, Yard and Rule schemas together to enforce ADR 0004. It sits with the schema-walking machinery it is built on because it belongs to no one of the four.',
	],
	[
		join('src', 'validation', 'colocation.spec.ts'),
		'Asserts a property of the file tree, so its subject is the repository rather than a module. It does sit beside colocation.ts, and is listed only so the rule reads without a special case for itself.',
	],
]);

describe('spec placement', () => {
	it('keeps every spec beside the code it exercises', () => {
		expect(findMisplacedSpecs(REPO_ROOT, new Set(CROSS_CUTTING.keys()))).toEqual([]);
	});

	it('records a reason for every declared exception', () => {
		for (const [spec, reason] of CROSS_CUTTING) {
			expect(reason.length, `${spec} needs a reason, not an empty string`).toBeGreaterThan(40);
		}
	});
});

describe('findMisplacedSpecs', () => {
	// A check that cannot fail is worse than no check, so this proves the
	// detector reports a spec with no subject beside it.
	it('reports a spec with no sibling implementation', () => {
		const root = mkdtempSync(join(tmpdir(), 'colocation-'));
		mkdirSync(join(root, 'src'), { recursive: true });
		writeFileSync(join(root, 'src', 'orphan.spec.ts'), '');

		expect(findMisplacedSpecs(root)).toEqual([join('src', 'orphan.spec.ts')]);
	});

	it('accepts a spec whose subject sits beside it under another extension', () => {
		const root = mkdtempSync(join(tmpdir(), 'colocation-'));
		mkdirSync(join(root, 'scripts'), { recursive: true });
		writeFileSync(join(root, 'scripts', 'build.ts'), '');
		writeFileSync(join(root, 'scripts', 'build.spec.mjs'), '');

		expect(findMisplacedSpecs(root)).toEqual([]);
	});

	// A prerender spec re-runs the module beside it under a server-side
	// environment, so that module is its subject.
	it('pairs a prerender spec with the module it re-runs', () => {
		const root = mkdtempSync(join(tmpdir(), 'colocation-'));
		mkdirSync(join(root, 'src'), { recursive: true });
		writeFileSync(join(root, 'src', 'thing.ts'), '');
		writeFileSync(join(root, 'src', 'thing.prerender.spec.ts'), '');

		expect(findMisplacedSpecs(root)).toEqual([]);
	});

	// Stripping the `.prerender` suffix changes which name the lookup asks for.
	// It does not excuse the spec from having a subject at all.
	it('reports a prerender spec whose module is missing', () => {
		const root = mkdtempSync(join(tmpdir(), 'colocation-'));
		mkdirSync(join(root, 'src'), { recursive: true });
		writeFileSync(join(root, 'src', 'ghost.prerender.spec.ts'), '');

		expect(findMisplacedSpecs(root)).toEqual([join('src', 'ghost.prerender.spec.ts')]);
	});

	it('ignores end-to-end specs, which drive the built site rather than a module', () => {
		const root = mkdtempSync(join(tmpdir(), 'colocation-'));
		mkdirSync(join(root, 'tests', 'integration'), { recursive: true });
		writeFileSync(join(root, 'tests', 'integration', 'smoke.spec.ts'), '');

		expect(findMisplacedSpecs(root)).toEqual([]);
	});
});
