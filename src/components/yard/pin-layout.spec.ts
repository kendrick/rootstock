import type { Plant } from '@/yard/plant';
import { describe, expect, it } from 'vitest';
import { seedPlants } from '@/seed';
import { declutteredPositions, MIN_CENTER_DISTANCE_PX } from './pin-layout';

/** The photo's own aspect ratio (2400 / 1800), which every call below assumes. */
const BOX_ASPECT = 1800 / 2400;

function sitedPlant(id: string, x: number, y: number): Plant {
	const template = seedPlants.find(plant => plant.position !== null);
	if (template === undefined) {
		throw new Error('the seed carries no sited plant for this fixture to spread from.');
	}
	return { ...template, id, name: id, position: { x, y } };
}

function distancePx(
	positions: Map<string, { x: number; y: number }>,
	boxWidth: number,
	boxHeight: number,
	leftId: string,
	rightId: string,
): number {
	const left = positions.get(leftId);
	const right = positions.get(rightId);
	if (left === undefined || right === undefined) {
		throw new Error('both ids need a resolved position for this test to compare them.');
	}
	const dx = (left.x - right.x) * boxWidth;
	const dy = (left.y - right.y) * boxHeight;
	return Math.hypot(dx, dy);
}

describe('declutteredPositions', () => {
	it('leaves a pin untouched when nothing else is nearby', () => {
		const plants = [sitedPlant('lone', 0.5, 0.5)];

		const positions = declutteredPositions(plants, BOX_ASPECT);

		expect(positions.get('lone')).toEqual({ x: 0.5, y: 0.5 });
	});

	it('drops a Plant with no position from the result, rather than inventing one', () => {
		const unsited: Plant = { ...sitedPlant('unsited', 0, 0), position: null };

		const positions = declutteredPositions([unsited], BOX_ASPECT);

		expect(positions.has('unsited')).toBe(false);
	});

	// The four hibiscus-and-esperanza plants the seed sites within a 22px span
	// (the critique's own measurement) are the reproduction case: this asserts
	// the property the ticket actually cares about, that every pair clears the
	// pin's own diameter, rather than pinning the exact output coordinates.
	it('separates every pair to at least the minimum centre distance, at the mobile reference width', () => {
		const plants = [
			sitedPlant('a', 0.44, 0.68),
			sitedPlant('b', 0.40, 0.69),
			sitedPlant('c', 0.43, 0.70),
			sitedPlant('d', 0.46, 0.71),
		];
		const boxWidth = 358;
		const boxHeight = boxWidth * BOX_ASPECT;

		const positions = declutteredPositions(plants, BOX_ASPECT);

		for (const left of plants) {
			for (const right of plants) {
				if (left.id === right.id) {
					continue;
				}
				expect(distancePx(positions, boxWidth, boxHeight, left.id, right.id))
					.toBeGreaterThanOrEqual(MIN_CENTER_DISTANCE_PX - 0.01);
			}
		}
	});

	it('keeps every resolved position inside the photo, even after nudging a crowded cluster apart', () => {
		const plants = [
			sitedPlant('a', 0.01, 0.01),
			sitedPlant('b', 0.02, 0.01),
			sitedPlant('c', 0.01, 0.02),
		];

		const positions = declutteredPositions(plants, BOX_ASPECT);

		for (const position of positions.values()) {
			expect(position.x).toBeGreaterThanOrEqual(0);
			expect(position.x).toBeLessThanOrEqual(1);
			expect(position.y).toBeGreaterThanOrEqual(0);
			expect(position.y).toBeLessThanOrEqual(1);
		}
	});

	// The regression this exists for: the seed's own crowded four, read
	// straight off the real inventory rather than retyped by hand.
	it('separates the seed\'s own crowded cluster of pins', () => {
		const crowded = seedPlants.filter(plant =>
			['esperanza-1', 'hibiscus-watermelon-ruffles', 'hibiscus-starry-night', 'hibiscus-luna-white'].includes(plant.id));
		expect(crowded).toHaveLength(4);

		const boxWidth = 358;
		const boxHeight = boxWidth * BOX_ASPECT;
		const positions = declutteredPositions(crowded, BOX_ASPECT);

		for (const left of crowded) {
			for (const right of crowded) {
				if (left.id === right.id) {
					continue;
				}
				expect(distancePx(positions, boxWidth, boxHeight, left.id, right.id))
					.toBeGreaterThanOrEqual(MIN_CENTER_DISTANCE_PX - 0.01);
			}
		}
	});
});
