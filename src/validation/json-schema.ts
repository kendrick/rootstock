export type JsonSchema = Record<string, unknown>;

/**
 * Walks a JSON Schema depth-first, visiting the root and every nested subschema reachable through
 * `properties`, `items`, `anyOf`, `oneOf`, `allOf`, `$defs` and `definitions`. A schema generator
 * nests object and array shapes under any of these keywords, and downstream checks that assert
 * something holds "everywhere in the schema"—every object closing over `additionalProperties`,
 * every property listed in `required`, no property name that looks like a coordinate—are only as
 * good as this traversal: skip one nesting form here and those checks pass on a schema that
 * silently violates the rule three levels down.
 */
export function walkSchema(schema: JsonSchema, visit: (node: JsonSchema, path: string) => void): void {
	visitNode(schema, '#', visit);
}

function visitNode(node: JsonSchema, path: string, visit: (node: JsonSchema, path: string) => void): void {
	visit(node, path);

	const properties = node.properties;
	if (isJsonSchema(properties)) {
		for (const [key, value] of Object.entries(properties)) {
			if (isJsonSchema(value)) {
				visitNode(value, `${path}/properties/${key}`, visit);
			}
		}
	}

	const items = node.items;
	if (isJsonSchema(items)) {
		visitNode(items, `${path}/items`, visit);
	}
	else if (Array.isArray(items)) {
		items.forEach((item: unknown, index) => {
			if (isJsonSchema(item)) {
				visitNode(item, `${path}/items/${index}`, visit);
			}
		});
	}

	for (const keyword of ['anyOf', 'oneOf', 'allOf'] as const) {
		const list = node[keyword];
		if (Array.isArray(list)) {
			list.forEach((subschema: unknown, index) => {
				if (isJsonSchema(subschema)) {
					visitNode(subschema, `${path}/${keyword}/${index}`, visit);
				}
			});
		}
	}

	for (const keyword of ['$defs', 'definitions'] as const) {
		const defs = node[keyword];
		if (isJsonSchema(defs)) {
			for (const [key, value] of Object.entries(defs)) {
				if (isJsonSchema(value)) {
					visitNode(value, `${path}/${keyword}/${key}`, visit);
				}
			}
		}
	}
}

function isJsonSchema(value: unknown): value is JsonSchema {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `walkSchema`'s visits collected into an array, in visit order, for a caller that has to assert over the whole walk rather than react to one node at a time. Both specs under `src/artifact/` read it, and a private copy in either of them drifts the moment the walker's path format changes.
 */
export function nodes(schema: JsonSchema): Array<{ path: string; node: JsonSchema }> {
	const visited: Array<{ path: string; node: JsonSchema }> = [];
	walkSchema(schema, (node, path) => visited.push({ path, node }));
	return visited;
}
