import type { JsonSchema } from '@/validation/json-schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { walkSchema } from '@/validation/json-schema';
import { artifactSchema, parseArtifact, parseStatusRecord, safeParseArtifact } from './artifact';
import { narratedArtifact, unnarratedArtifact } from './fixtures';

function nodes(schema: JsonSchema): Array<{ path: string; node: JsonSchema }> {
	const visited: Array<{ path: string; node: JsonSchema }> = [];
	walkSchema(schema, (node, path) => visited.push({ path, node }));
	return visited;
}

function isRecord(value: unknown): value is JsonSchema {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Zod writes nullability two ways, and which one it picks depends on the inner type rather than on
// anything the schema author chose: a bare primitive widens to `type: ['string', 'null']`, while an
// object, an array, an enum, or a primitive carrying a check becomes `anyOf: [..., {type: 'null'}]`.
// A check that knew one form would silently stop looking at half the nullable fields.
function isNullable(node: JsonSchema): boolean {
	if (Array.isArray(node.type) && node.type.includes('null')) {
		return true;
	}
	return Array.isArray(node.anyOf)
		&& node.anyOf.some(option => isRecord(option) && option.type === 'null');
}

describe('parseArtifact', () => {
	it('round-trips a narrated artifact', () => {
		expect(parseArtifact(narratedArtifact)).toEqual(narratedArtifact);
	});

	it('round-trips an un-narrated artifact', () => {
		expect(parseArtifact(unnarratedArtifact)).toEqual(unnarratedArtifact);
	});

	// The two fields say the same thing, so the only way they stay true is if a parse rejects the
	// moment they disagree. Both directions are tested because each is a different bug: the first is
	// a runner that recorded a narration it never got, the second is one that dropped the prose on
	// its way to the file.
	it('rejects narrated: true with no narration', () => {
		expect(() => parseArtifact({ ...narratedArtifact, narration: null }))
			.toThrow(/narrated must be true if and only if narration is present/);
	});

	it('rejects narrated: false alongside a narration', () => {
		expect(() => parseArtifact({ ...narratedArtifact, narrated: false }))
			.toThrow(/narrated must be true if and only if narration is present/);
	});

	// `asOf` is the extra field somebody will reach for, per the note in artifact.ts, so it is the
	// one worth pinning. A key nobody declared is an authoring mistake, and the parse says so.
	it('rejects an extra top-level property', () => {
		expect(() => parseArtifact({ ...narratedArtifact, asOf: '2026-09-11' }))
			.toThrow(/Unrecognized key: "asOf"/);
	});

	it('rejects a generatedAt that is not an ISO datetime', () => {
		expect(() => parseArtifact({ ...narratedArtifact, generatedAt: '2026-09-11' }))
			.toThrow(/^artifact: generatedAt /);
	});

	it('rejects a task status the Planner never writes', () => {
		const unknownStatus = {
			...narratedArtifact,
			plan: {
				...narratedArtifact.plan,
				tasks: narratedArtifact.plan.tasks.map((task, index) =>
					index === 0 ? { ...task, status: 'pending' } : task,
				),
			},
		};

		expect(() => parseArtifact(unknownStatus)).toThrow(/plan\.tasks\[0\]\.status/);
	});
});

describe('safeParseArtifact', () => {
	it('returns the parsed artifact', () => {
		expect(safeParseArtifact(narratedArtifact)).toEqual({ ok: true, value: narratedArtifact });
	});

	// The browser parses the published file on load, so the failure has to arrive as something it can
	// render. A bare `ok: false` would be a blank error state; the message has to name the field.
	it('returns a failure naming the path that failed', () => {
		const result = safeParseArtifact({ ...narratedArtifact, version: 2 });

		expect(result.ok).toBe(false);
		expect(result.ok ? '' : result.error).toMatch(/^artifact: version /);
	});
});

describe('parseStatusRecord', () => {
	const failedRun = {
		attemptedAt: '2026-09-11T11:04:07Z',
		ok: false,
		error: 'open-meteo returned 503',
		artifactGeneratedAt: '2026-09-10T11:03:58Z',
		consecutiveFailures: 4,
	};

	it('round-trips a failed run that still has yesterday\'s artifact published', () => {
		expect(parseStatusRecord(failedRun)).toEqual(failedRun);
	});

	it('round-trips a successful run', () => {
		const succeeded = {
			...failedRun,
			ok: true,
			error: null,
			artifactGeneratedAt: '2026-09-11T11:04:07Z',
			consecutiveFailures: 0,
		};

		expect(parseStatusRecord(succeeded)).toEqual(succeeded);
	});

	it('rejects a successful run carrying an error', () => {
		expect(() => parseStatusRecord({ ...failedRun, ok: true }))
			.toThrow(/error must be present if and only if ok is false/);
	});

	it('rejects a failed run with no error to show', () => {
		expect(() => parseStatusRecord({ ...failedRun, error: null }))
			.toThrow(/error must be present if and only if ok is false/);
	});

	it('rejects a negative failure count', () => {
		expect(() => parseStatusRecord({ ...failedRun, consecutiveFailures: -1 }))
			.toThrow(/^status record: consecutiveFailures /);
	});
});

// The generated JSON Schema is what a non-TypeScript reader of the published file gets. The
// assertions below are structural so that they hold for every field added later: an open object or
// a field that drops out of `required` fails here, on the commit that introduces it, rather than
// downstream in whatever trusted the schema and got a shape it did not expect.
describe('artifact keys on the way in', () => {
	// `.default(null)` makes a key omissible on input while leaving the parsed type
	// unchanged, and `z.toJSONSchema` defaults to output mode, where that is
	// invisible. Hand-authored records (Plant, Rule, Occurrence) carry defaults on
	// purpose; the Artifact must not, because it is machine-written and has to
	// round-trip through a committed file without a key quietly going missing.
	// Comparing the two modes is the only thing that sees the difference.
	it('requires the same keys in input mode as in output mode', () => {
		const requiredLists = (io: 'input' | 'output'): string[][] => {
			const found: string[][] = [];
			walkSchema(z.toJSONSchema(artifactSchema, { io }) as JsonSchema, (node) => {
				if (Array.isArray(node.required)) {
					found.push([...node.required].sort());
				}
			});
			return found;
		};

		expect(requiredLists('input')).toEqual(requiredLists('output'));
	});
});

describe('artifact json schema', () => {
	const schema = z.toJSONSchema(artifactSchema);

	it('describes an object at the root', () => {
		expect(schema.type).toBe('object');
	});

	it('closes every object and requires every property it declares', () => {
		const objects = nodes(schema).filter(({ node }) => node.type === 'object');

		// A traversal that stops finding objects would leave the loop below running zero times and
		// passing while checking nothing.
		expect(objects.length).toBeGreaterThan(5);

		for (const { path, node } of objects) {
			expect(node.additionalProperties, `${path} must be closed`).toBe(false);
			expect(
				node.required,
				`${path} must require every property it declares`,
			).toEqual(Object.keys(node.properties as Record<string, unknown>));
		}
	});

	// Absence is `.nullable()` here, never `.optional()`, and this is the check that keeps it that
	// way: an optional field drops out of `required` and a reader can no longer tell a run that had
	// nothing to say from a run that never wrote the field at all.
	it('still requires every nullable field', () => {
		const byPath = new Map(nodes(schema).map(({ path, node }) => [path, node]));
		const nullableFields = [...byPath].filter(([path, node]) =>
			/\/properties\/[^/]+$/.test(path) && isNullable(node),
		);

		// Both encodings have to be in play, or this test proves only that `isNullable` found the one
		// form it happened to look at first: `narration` is the object form, `depthCm` the primitive.
		const names = nullableFields.map(([path]) => path.split('/').at(-1));
		expect(names).toContain('narration');
		expect(names).toContain('depthCm');

		for (const [path] of nullableFields) {
			const field = path.split('/').at(-1) as string;
			const parent = byPath.get(path.slice(0, -`/properties/${field}`.length));

			expect(parent?.required, `${path} must stay in its parent's required list`).toContain(field);
		}
	});
});
