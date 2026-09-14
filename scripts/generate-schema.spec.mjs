import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { narrationJsonSchema } from '../src/artifact/narration';

// schemas/narration.schema.json is committed, not generated on demand, because
// `codex exec --output-schema` reads it straight off disk. This spec is the only thing
// standing between an edit to narrationSchema and a committed file that quietly stops
// matching it—`pnpm schema` still has to be re-run by hand after such an edit.
describe('generate-schema', () => {
	it('matches a fresh generation from narrationSchema', () => {
		const committed = JSON.parse(
			readFileSync(path.resolve(import.meta.dirname, '../schemas/narration.schema.json'), 'utf8'),
		);

		expect(committed).toStrictEqual(narrationJsonSchema());
	});
});
