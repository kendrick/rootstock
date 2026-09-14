import type { JsonSchema } from './json-schema';
import { describe, expect, it } from 'vitest';
import { nodes } from './json-schema';

// The traversal cases read the walk through `nodes`, which is `walkSchema` with its visits collected. Re-declaring that collector here would put a third copy of it in the repo, and one copy is what `nodes` is exported for.
describe('walkSchema', () => {
	it('visits the root even when it has no nested subschemas', () => {
		const schema: JsonSchema = { type: 'string' };

		const visited = nodes(schema);

		expect(visited).toEqual([{ path: '#', node: schema }]);
	});

	it('recurses into each property of an object schema', () => {
		const schema: JsonSchema = {
			type: 'object',
			properties: {
				name: { type: 'string' },
				age: { type: 'number' },
			},
		};

		const paths = nodes(schema).map(entry => entry.path);

		expect(paths).toEqual(['#', '#/properties/name', '#/properties/age']);
	});

	it('recurses into array items, including the tuple form of items', () => {
		const listSchema: JsonSchema = {
			type: 'array',
			items: { type: 'string' },
		};
		const tupleSchema: JsonSchema = {
			type: 'array',
			items: [{ type: 'string' }, { type: 'number' }],
		};

		expect(nodes(listSchema).map(entry => entry.path)).toEqual(['#', '#/items']);
		expect(nodes(tupleSchema).map(entry => entry.path)).toEqual([
			'#',
			'#/items/0',
			'#/items/1',
		]);
	});

	it('recurses into anyOf, oneOf and allOf branches', () => {
		const schema: JsonSchema = {
			anyOf: [{ type: 'string' }, { type: 'number' }],
			oneOf: [{ type: 'boolean' }],
			allOf: [{ type: 'null' }],
		};

		const paths = nodes(schema).map(entry => entry.path);

		expect(paths).toEqual([
			'#',
			'#/anyOf/0',
			'#/anyOf/1',
			'#/oneOf/0',
			'#/allOf/0',
		]);
	});

	it('recurses into $defs and definitions', () => {
		const schema: JsonSchema = {
			$defs: { widget: { type: 'string' } },
			definitions: { gadget: { type: 'number' } },
		};

		const paths = nodes(schema).map(entry => entry.path);

		expect(paths).toEqual(['#', '#/$defs/widget', '#/definitions/gadget']);
	});

	// This is the shape a real generated artifact schema takes: a property whose schema is a
	// union, one branch of which is an object with its own nested property. A walker that only
	// looked at top-level `properties`—or that skipped recursing through `anyOf`—would never
	// reach `coordinate`, and every downstream test that scans for a coordinate-shaped property
	// name would pass on a schema that still has one buried three levels down.
	it('reaches a node nested three levels deep through an anyOf branch', () => {
		const schema: JsonSchema = {
			type: 'object',
			properties: {
				observation: {
					anyOf: [
						{ type: 'null' },
						{
							type: 'object',
							properties: {
								coordinate: { type: 'string' },
							},
						},
					],
				},
			},
		};

		const paths = nodes(schema).map(entry => entry.path);

		expect(paths).toContain('#/properties/observation/anyOf/1/properties/coordinate');

		const found = nodes(schema).find(
			entry => entry.path === '#/properties/observation/anyOf/1/properties/coordinate',
		);
		expect(found?.node).toEqual({ type: 'string' });
	});

	it('does not descend into non-schema values, such as a plain array under an unrelated key', () => {
		const schema: JsonSchema = {
			type: 'string',
			enum: ['a', 'b', 'c'],
		};

		const paths = nodes(schema).map(entry => entry.path);

		expect(paths).toEqual(['#']);
	});
});

describe('nodes', () => {
	it('walks a small schema with object properties and an array items, returning visited paths and nodes', () => {
		const schema: JsonSchema = {
			type: 'object',
			properties: {
				name: { type: 'string' },
				tags: {
					type: 'array',
					items: { type: 'string' },
				},
			},
		};

		const visited = nodes(schema);
		const paths = visited.map(entry => entry.path);

		expect(paths).toEqual(['#', '#/properties/name', '#/properties/tags', '#/properties/tags/items']);
	});
});
