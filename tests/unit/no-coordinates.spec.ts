import type { JsonSchema } from '@/validation/json-schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { artifactSchema } from '@/artifact/artifact';
import { ruleSchema } from '@/rules/rule';
import { walkSchema } from '@/validation/json-schema';
import { plantSchema, yardSchema } from '@/yard/plant';

/*
 * ADR 0004: the property's latitude and longitude live in the generation
 * environment and nowhere else. The repository is public and the site it
 * publishes is public whatever the repository's visibility, so the coordinates
 * are the one fact worth real effort to keep out.
 *
 * Nothing carries them today. The test is here for the field someone adds in a
 * year, on a schema that already looks safe, because a marker or a weather
 * call wanted a pair of numbers close to hand. Walking the generated JSON
 * Schema catches the field itself rather than the value in it, so it fires on
 * the commit that declares the field and not on the day somebody fills it in
 * with the real thing.
 */

// Deliberately loose. `lat` alone matches ordinary English words, and a false positive here costs
// one rename argued out in review, where a false negative costs the thing the ADR exists to protect.
const COORDINATE = /lat|lon|lng|coord/i;

const schemas = [
	['Artifact', artifactSchema],
	['Plant', plantSchema],
	['Yard', yardSchema],
	['Rule', ruleSchema],
] as const;

function coordinateNames(schema: JsonSchema): string[] {
	const offenders: string[] = [];
	walkSchema(schema, (node, path) => {
		const properties = node.properties;
		if (typeof properties !== 'object' || properties === null) {
			return;
		}
		for (const key of Object.keys(properties)) {
			if (COORDINATE.test(key)) {
				offenders.push(`${path}/properties/${key}`);
			}
		}
	});
	return offenders;
}

describe('no schema names a coordinate', () => {
	for (const [name, schema] of schemas) {
		it(`${name} carries no latitude or longitude at any depth`, () => {
			const json = z.toJSONSchema(schema) as JsonSchema;

			expect(coordinateNames(json), `${name} names a coordinate`).toEqual([]);
			// Guards the guard: if the walk ever visits nothing, the assertion above passes on an
			// empty list and this file stops testing anything.
			expect(namedProperties(json).length, `${name} must expose properties to walk`).toBeGreaterThan(0);
		});
	}

	it('reports the path of a coordinate somebody adds later', () => {
		const withCoordinates = z.strictObject({
			id: z.string(),
			home: z.strictObject({ latitude: z.number(), longitude: z.number() }),
		});

		expect(coordinateNames(z.toJSONSchema(withCoordinates) as JsonSchema)).toEqual([
			'#/properties/home/properties/latitude',
			'#/properties/home/properties/longitude',
		]);
	});
});

function namedProperties(schema: JsonSchema): string[] {
	const names: string[] = [];
	walkSchema(schema, (node) => {
		const properties = node.properties;
		if (typeof properties === 'object' && properties !== null) {
			names.push(...Object.keys(properties));
		}
	});
	return names;
}
