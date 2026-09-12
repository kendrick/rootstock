import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadArtifact } from './load';

const REPO_ROOT = join(import.meta.dirname, '..', '..');

// Reads and parses the committed file directly, independent of the loader
// under test, so a loader that reshaped, defaulted, or dropped a field would
// disagree with this rather than confirm itself.
function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, 'utf8'));
}

describe('loadArtifact', () => {
	it('returns data/artifact.json and data/status.json untouched', () => {
		const expectedArtifact = readJson(join(REPO_ROOT, 'data', 'artifact.json'));
		const expectedStatus = readJson(join(REPO_ROOT, 'data', 'status.json'));

		const { artifact, status } = loadArtifact();

		expect(artifact).toEqual(expectedArtifact);
		expect(status).toEqual(expectedStatus);
	});
});
