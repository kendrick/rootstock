import { describe, expect, it } from 'vitest';
import { lawnDetailSchema, plantSchema, positionSchema, regionSchema, yardSchema } from './plant';

describe('regionSchema', () => {
	it('parses a city and hardiness zone', () => {
		const region = regionSchema.parse({ name: 'Austin, TX', hardinessZone: '8b' });
		expect(region).toEqual({ name: 'Austin, TX', hardinessZone: '8b' });
	});

	it('rejects a coordinate-shaped field', () => {
		expect(() => regionSchema.parse({ name: 'Austin, TX', hardinessZone: '8b', latitude: 30.27 })).toThrow();
	});
});

describe('positionSchema', () => {
	it('parses fractions within 0..1', () => {
		expect(positionSchema.parse({ x: 0, y: 1 })).toEqual({ x: 0, y: 1 });
	});

	it('rejects an x fraction above 1', () => {
		expect(() => positionSchema.parse({ x: 1.5, y: 0.5 })).toThrow();
	});

	it('rejects a y fraction below 0', () => {
		expect(() => positionSchema.parse({ x: 0.5, y: -0.1 })).toThrow();
	});
});

describe('plantSchema', () => {
	const baseLawn = {
		grass: 'bermuda',
		areaSqFt: 1200,
		soil: 'clay',
		irrigation: { schedule: 'MWF 6am', source: 'asserted' as const },
	};

	it('parses a planted fig with nullable fields omitted', () => {
		const plant = plantSchema.parse({
			id: 'fig-1',
			name: 'Chicago Hardy Fig',
			kind: 'plant',
			status: 'planted',
			tags: ['fruit', 'deciduous'],
		});

		expect(plant.position).toBeNull();
		expect(plant.site).toBeNull();
		expect(plant.lawn).toBeNull();
		expect(plant.notes).toBeNull();
	});

	it('parses a lawn entry carrying lawn detail', () => {
		const lawn = plantSchema.parse({
			id: 'front-lawn',
			name: 'Front Lawn',
			kind: 'lawn',
			status: 'planted',
			tags: ['turf'],
			lawn: baseLawn,
		});

		expect(lawn.lawn).toEqual(lawnDetailSchema.parse(baseLawn));
	});

	it('parses full nullable fields with a position, site, and notes', () => {
		const plant = plantSchema.parse({
			id: 'fig-1',
			name: 'Chicago Hardy Fig',
			kind: 'plant',
			status: 'planned',
			tags: ['fruit'],
			position: { x: 0.25, y: 0.6 },
			site: 'NW corner, sandy fill on a slope, west-facing stone wall',
			notes: 'planted from a cutting',
		});

		expect(plant.position).toEqual({ x: 0.25, y: 0.6 });
	});

	it('rejects kind lawn without lawn detail', () => {
		expect(() =>
			plantSchema.parse({
				id: 'front-lawn',
				name: 'Front Lawn',
				kind: 'lawn',
				status: 'planted',
				tags: ['turf'],
			}),
		).toThrow();
	});

	it('rejects a non-lawn kind carrying lawn detail', () => {
		expect(() =>
			plantSchema.parse({
				id: 'fig-1',
				name: 'Chicago Hardy Fig',
				kind: 'plant',
				status: 'planted',
				tags: ['fruit'],
				lawn: baseLawn,
			}),
		).toThrow();
	});

	it('rejects an unknown key', () => {
		expect(() =>
			plantSchema.parse({
				id: 'fig-1',
				name: 'Chicago Hardy Fig',
				kind: 'plant',
				status: 'planted',
				tags: ['fruit'],
				latitude: 30.27,
			}),
		).toThrow();
	});
});

describe('yardSchema', () => {
	it('parses a yard with region only, defaulting photo and overlays', () => {
		const yard = yardSchema.parse({
			id: 'home-yard',
			region: { name: 'Austin, TX', hardinessZone: '8b' },
		});

		expect(yard.photo).toBeNull();
		expect(yard.overlays).toEqual([]);
	});

	it('parses a yard with a photo', () => {
		const yard = yardSchema.parse({
			id: 'home-yard',
			region: { name: 'Austin, TX', hardinessZone: '8b' },
			photo: { path: 'yard.jpg', width: 4032, height: 3024 },
		});

		expect(yard.photo).toEqual({ path: 'yard.jpg', width: 4032, height: 3024 });
	});

	it('rejects a non-empty overlays array', () => {
		expect(() =>
			yardSchema.parse({
				id: 'home-yard',
				region: { name: 'Austin, TX', hardinessZone: '8b' },
				overlays: [{}],
			}),
		).toThrow();
	});
});
