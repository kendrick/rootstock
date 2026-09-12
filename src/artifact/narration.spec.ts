import type { JsonSchema } from '@/validation/json-schema';
import { describe, expect, it } from 'vitest';
import { walkSchema } from '@/validation/json-schema';
import { narrationJsonSchema, parseNarration } from './narration';

// The keywords OpenAI's strict structured-output mode accepts for a schema of this shape. An
// allowlist rather than a denylist, because a denylist of `oneOf`, `const` and `minimum` catches
// only the keywords someone already knew to look for, and the failure this guards against is a Zod
// upgrade emitting a keyword nobody has seen yet. Anything new shows up here as a failing test
// rather than an opaque HTTP 400 from a generation run.
const ALLOWED_KEYWORDS = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'description']);

function nodes(schema: JsonSchema): Array<{ path: string; node: JsonSchema }> {
	const visited: Array<{ path: string; node: JsonSchema }> = [];
	walkSchema(schema, (node, path) => visited.push({ path, node }));
	return visited;
}

const validNarration = {
	summary: 'A cool, wet week. The soil finally came up to temperature, so the pre-emergent window is open.',
	tasks: [
		{ taskId: 'task-pre-emergent-front-lawn', text: 'Put down fall pre-emergent on the front lawn before Thursday\'s rain.' },
		{ taskId: 'task-water-fig-1', text: 'Give the fig a deep soak; it has been three weeks.' },
	],
	advisories: [
		{ text: 'The crape myrtle on the north fence is dropping leaves early, which is worth a look next week.' },
	],
};

describe('narrationJsonSchema', () => {
	it('emits only keywords strict structured-output mode accepts', () => {
		const offenders = nodes(narrationJsonSchema())
			.flatMap(({ path, node }) =>
				Object.keys(node)
					.filter(key => !ALLOWED_KEYWORDS.has(key))
					.map(key => `${path}: ${key}`),
			);

		expect(offenders).toEqual([]);
	});

	it('strips the $schema dialect declaration from the root', () => {
		expect(narrationJsonSchema()).not.toHaveProperty('$schema');
	});

	it('describes an object at the root', () => {
		expect(narrationJsonSchema().type).toBe('object');
	});

	it('closes every object and requires every property it declares', () => {
		const objects = nodes(narrationJsonSchema()).filter(({ node }) => node.type === 'object');

		// If the traversal ever stops finding objects, the loop below runs zero times and the test
		// passes while checking nothing, so count them first.
		expect(objects.length).toBeGreaterThan(0);

		for (const { path, node } of objects) {
			expect(node.additionalProperties, `${path} must be closed`).toBe(false);
			expect(
				node.required,
				`${path} must require every property it declares`,
			).toEqual(Object.keys(node.properties as Record<string, unknown>));
		}
	});

	it('carries a non-empty description on every field the model has to fill', () => {
		// A field is a node sitting directly under a `properties` map. An array's `items` node also
		// has `/properties/` somewhere in its path and carries no description of its own, so this
		// matches the tail of the path to leave the `items` wrappers out.
		const fields = nodes(narrationJsonSchema()).filter(({ path }) => /\/properties\/[^/]+$/.test(path));

		expect(fields.map(({ path }) => path)).toEqual([
			'#/properties/summary',
			'#/properties/tasks',
			'#/properties/tasks/items/properties/taskId',
			'#/properties/tasks/items/properties/text',
			'#/properties/advisories',
			'#/properties/advisories/items/properties/text',
		]);

		for (const { path, node } of fields) {
			expect(typeof node.description, `${path} must be described`).toBe('string');
			expect((node.description as string).trim().length, `${path} must be described`).toBeGreaterThan(0);
		}
	});
});

describe('parseNarration', () => {
	it('parses a narration with a summary, tasks and advisories', () => {
		expect(parseNarration(validNarration)).toEqual(validNarration);
	});

	it('parses a narration with no advisories', () => {
		expect(parseNarration({ ...validNarration, advisories: [] }).advisories).toEqual([]);
	});

	it('rejects an extra property', () => {
		expect(() => parseNarration({ ...validNarration, tone: 'cheerful' })).toThrow(/narration/);
	});

	it('rejects a narration missing advisories', () => {
		const { advisories: _dropped, ...withoutAdvisories } = validNarration;

		expect(() => parseNarration(withoutAdvisories)).toThrow(/narration/);
	});

	// A task the Planner never wrote is the failure ADR 0001 exists to prevent, and the task id is
	// the handle the membership check downstream uses. The schema cannot know which ids are real, so
	// the most it can do is insist the field is present and is a string. This pins that much.
	it('rejects a task carrying prose but no task id', () => {
		expect(() => parseNarration({ ...validNarration, tasks: [{ text: 'Mow the lawn.' }] })).toThrow(/taskId/);
	});
});
