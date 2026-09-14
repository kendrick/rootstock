import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';
import { BASE_PATH } from './src/lib/base-path';

// GitHub Pages serves files, not a Node process. Every constraint below is one
// the deploy would otherwise discover for us, in production, as a blank page or
// a 404 on every asset. They are cheap to assert and expensive to learn the
// other way, so they live here rather than in a reviewer's memory.
describe('static export constraints', () => {
	it('builds to a static export', () => {
		expect(nextConfig.output).toBe('export');
	});

	// Project pages are served from /<repo>, not the domain root. Drop this and
	// every stylesheet and script 404s on the deployed site while working locally.
	//
	// Read off the shared constant rather than the literal '/rootstock': the
	// yard photo 404ed in production because next/image needed that same value
	// and had no way to read it except a second, independently-typed copy. This
	// is the assertion that would have caught the two drifting apart.
	it('sets the project-page base path from the shared constant', () => {
		expect(nextConfig.basePath).toBe(BASE_PATH);
	});

	// The image optimizer is a server route. Without this, next/image fails the
	// export build outright.
	it('disables image optimization', () => {
		expect(nextConfig.images?.unoptimized).toBe(true);
	});
});

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

// A single one of these turns `next build` into a failure, so the guard is a
// file scan rather than a convention nobody rechecks.
describe('no server runtime', () => {
	const files = walk('src');

	it('declares no route handlers', () => {
		expect(files.filter(f => /(?:^|\/)route\.tsx?$/.test(f))).toEqual([]);
	});

	it('declares no middleware', () => {
		expect(files.filter(f => /(?:^|\/)middleware\.tsx?$/.test(f))).toEqual([]);
	});

	it('declares no server actions', () => {
		const offenders = files
			.filter(f => /\.tsx?$/.test(f))
			.filter(f => /['"]use server['"]/.test(readFileSync(f, 'utf8')));
		expect(offenders).toEqual([]);
	});
});
