import type { Plant } from '@/yard/plant';
import { describe, expect, it } from 'vitest';
import { seedPlants, seedYard } from '@/seed';
import { BAND_FRACTION, declutteredPositions, MIN_CENTER_DISTANCE_PX, MOBILE_BOX_WIDTH_PX } from './pin-layout';

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
	// 346 is the photo's measured width at 390px under the sheet frame. Written
	// as the number, not the arithmetic, so a gutter change fails here.
	it('lays pins out against the photo width a phone actually renders', () => {
		expect(MOBILE_BOX_WIDTH_PX).toBe(346);
	});

	// The seed's real positions, at the real phone width: every pair of pins
	// ends at least MIN_CENTER_DISTANCE_PX apart, edges included. Clamping only
	// after spacing once pulled two top-edge pins back within 28px.
	it('keeps every seed pin pair apart once the edges are held', () => {
		const photo = seedYard.photo;
		if (photo === null) {
			throw new Error('the seed yard carries no photo to lay pins out on');
		}
		const aspect = photo.height / photo.width;
		const positions = declutteredPositions(seedPlants, aspect);
		const ids = [...positions.keys()];
		const height = MOBILE_BOX_WIDTH_PX * aspect;

		for (let i = 0; i < ids.length; i++) {
			for (let j = i + 1; j < ids.length; j++) {
				expect(distancePx(positions, MOBILE_BOX_WIDTH_PX, height, ids[i]!, ids[j]!)).toBeGreaterThanOrEqual(MIN_CENTER_DISTANCE_PX - 0.5);
			}
		}
	});

	// A pin at the edge of the photo is clipped by the frame, so no pin centre
	// may sit closer to an edge than half a 24px pin.
	it('keeps a pin at the edge fully on the photo', () => {
		const positions = declutteredPositions([sitedPlant('edge', 0.5, 0)], BOX_ASPECT);
		const y = positions.get('edge')?.y ?? 0;

		expect(y * MOBILE_BOX_WIDTH_PX * BOX_ASPECT).toBeCloseTo(12, 5);
	});

	it('leaves a pin untouched when nothing else is nearby', () => {
		const plants = [sitedPlant('lone', 0.5, 0.5)];

		const positions = declutteredPositions(plants, BOX_ASPECT);

		expect(positions.get('lone')).toEqual({ x: 0.5, y: 0.5, anchor: null });
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

	// A crowded callout leaves the photo for the band on its own side, like a
	// parts plate's margin callout, so it never lands on another Plant's spot.
	it('keeps every callout across the photo\'s width and within one band of it', () => {
		const plants = [
			sitedPlant('a', 0.01, 0.01),
			sitedPlant('b', 0.02, 0.01),
			sitedPlant('c', 0.01, 0.02),
		];

		const positions = declutteredPositions(plants, BOX_ASPECT);

		for (const position of positions.values()) {
			expect(position.x).toBeGreaterThanOrEqual(0);
			expect(position.x).toBeLessThanOrEqual(1);
			expect(position.y).toBeGreaterThanOrEqual(-BAND_FRACTION);
			expect(position.y).toBeLessThanOrEqual(1 + BAND_FRACTION);
		}
	});

	it('moves a crowded pair into the band on its own side, each anchored to its true spot', () => {
		const plants = [
			sitedPlant('high-a', 0.44, 0.2),
			sitedPlant('high-b', 0.46, 0.2),
			sitedPlant('low-a', 0.44, 0.8),
			sitedPlant('low-b', 0.46, 0.8),
		];

		const positions = declutteredPositions(plants, BOX_ASPECT);

		for (const id of ['high-a', 'high-b']) {
			expect(positions.get(id)?.y).toBeCloseTo(-BAND_FRACTION / 2, 5);
		}
		for (const id of ['low-a', 'low-b']) {
			expect(positions.get(id)?.y).toBeCloseTo(1 + BAND_FRACTION / 2, 5);
		}
		expect(positions.get('high-a')?.anchor).toEqual({ x: 0.44, y: 0.2 });
		expect(positions.get('low-b')?.anchor).toEqual({ x: 0.46, y: 0.8 });
	});

	// The seed's patio: six Plants within about 30px. Every one of them has to
	// leave the photo, and the lawn, alone on its side, has to stay put.
	it('takes the seed\'s patio cluster out of the photo and leaves the lawn on its spot', () => {
		const photo = seedYard.photo;
		if (photo === null) {
			throw new Error('the seed yard carries no photo to lay pins out on');
		}
		const positions = declutteredPositions(seedPlants, photo.height / photo.width);

		for (const id of ['esperanza-1', 'hibiscus-watermelon-ruffles', 'hibiscus-starry-night', 'hibiscus-luna-white', 'crossvine-1', 'crossvine-2']) {
			expect(positions.get(id)?.y).toBeLessThan(0);
			expect(positions.get(id)?.anchor).not.toBeNull();
		}
		expect(positions.get('front-lawn')).toEqual({ x: 0.13, y: 0.52, anchor: null });
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
