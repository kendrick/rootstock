/*
 * `codex exec --output-schema` wants narration's shape as a JSON file on disk, not a Zod object at
 * import time — the schema has to exist before the process that would run the import even starts.
 * This script is the only thing that writes schemas/narration.schema.json, and it always writes the
 * same bytes for the same schema: `pnpm schema` twice in a row leaves the tree clean, which is what
 * lets generate-schema.spec.mjs treat any diff as drift instead of noise.
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { narrationJsonSchema } from '../src/artifact/narration';

const outFile = path.resolve(import.meta.dirname, '../schemas/narration.schema.json');
writeFileSync(outFile, `${JSON.stringify(narrationJsonSchema(), null, '\t')}\n`);
