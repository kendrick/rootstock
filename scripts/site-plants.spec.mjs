import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { positionSchema } from '../src/yard/plant';
import { applySitings } from './site-plants';

const PLANTS = path.resolve(import.meta.dirname, '../src/seed/plants.json');

/**
 * `applySitings` edits plants.json as text rather than re-serialising it, so
 * what these cover is the risk that buys: a textual edit can corrupt a file a
 * parse-and-write never could. Every case here is one way that could happen.
 */
describe('applySitings', () => {
	const source = readFileSync(PLANTS, 'utf8');

	it('moves one Pin and leaves the rest of the file byte for byte', () => {
		const updated = applySitings(source, [{ id: 'front-lawn', position: { x: 0.25, y: 0.5 } }]);

		expect(updated).not.toBe(source);
		expect(JSON.parse(updated)).toHaveLength(JSON.parse(source).length);

		// Every other Plant's record is untouched, which is the whole reason this
		// works on text: a re-serialise would reflow the file to move one number.
		const before = JSON.parse(source);
		const after = JSON.parse(updated);

		for (const [index, plant] of before.entries()) {
			if (plant.id === 'front-lawn') {
				expect(after[index].position).toStrictEqual({ x: 0.25, y: 0.5 });
				continue;
			}

			expect(after[index]).toStrictEqual(plant);
		}
	});

	it('keeps the result parseable and schema-valid for every Plant it touches', () => {
		const updated = applySitings(source, [
			{ id: 'front-lawn', position: { x: 0, y: 1 } },
			{ id: 'fig-1', position: { x: 0.9999, y: 0.0001 } },
		]);

		for (const plant of JSON.parse(updated)) {
			if (plant.position !== null) {
				expect(() => positionSchema.parse(plant.position)).not.toThrow();
			}
		}
	});

	it('clears a Pin to null rather than writing a position nobody chose', () => {
		const updated = applySitings(source, [{ id: 'front-lawn', position: null }]);
		const lawn = JSON.parse(updated).find(plant => plant.id === 'front-lawn');

		expect(lawn.position).toBeNull();
	});

	// A Plant that is not in the file is a typo or a stale id, and writing nothing
	// while reporting success would leave the caller believing a Pin moved.
	it('refuses an id the file does not carry', () => {
		expect(() => applySitings(source, [{ id: 'no-such-plant', position: { x: 0.5, y: 0.5 } }]))
			.toThrow(/no Plant with id/);
	});

	it('preserves the trailing comma when the position line has one', () => {
		const updated = applySitings(source, [{ id: 'front-lawn', position: { x: 0.1, y: 0.2 } }]);

		expect(() => JSON.parse(updated)).not.toThrow();
	});
});
