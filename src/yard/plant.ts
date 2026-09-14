import { z } from 'zod';
import { kebabIdSchema } from '@/validation/ids';

/**
 * A place is a city and a hardiness zone, never a coordinate pair. The
 * generation environment holds the exact lat/long (see
 * docs/adr/0004-coordinates-never-enter-the-repository.md); nothing that
 * reaches this repo, and nothing rendered from it, may carry one.
 */
export const regionSchema = z.strictObject({
	name: z.string(),
	hardinessZone: z.string(),
});

export type Region = z.infer<typeof regionSchema>;

/**
 * A placement expressed as a fraction of the yard photo's width and height,
 * rather than a pixel offset, so a marker stays put when the photo is
 * replaced at a different resolution.
 */
export const positionSchema = z.strictObject({
	x: z.number().min(0).max(1),
	y: z.number().min(0).max(1),
});

export type Position = z.infer<typeof positionSchema>;

/**
 * `source` distinguishes an owner's stated claim from a measured one. Only
 * `asserted` exists today; the enum leaves room for a future Rachio import
 * to report `rachio` without changing the shape of this record.
 */
export const irrigationSchema = z.strictObject({
	schedule: z.string(),
	source: z.enum(['asserted', 'rachio']),
});

export type Irrigation = z.infer<typeof irrigationSchema>;

export const lawnDetailSchema = z.strictObject({
	grass: z.string(),
	areaSqFt: z.number().positive(),
	soil: z.string(),
	irrigation: irrigationSchema,
});

export type LawnDetail = z.infer<typeof lawnDetailSchema>;

/**
 * A single planted thing, a container, a bed, or the lawn itself. `tags` is
 * how guards and rules elsewhere in the system select plants without
 * knowing their ids, so it stays a free-form array rather than an enum.
 *
 * The `lawn` field is required exactly when `kind` is `'lawn'`: a lawn entry
 * missing its detail, or a fig carrying lawn detail by copy-paste error, is
 * an authoring mistake worth catching at parse time rather than downstream.
 */
export const plantSchema = z.strictObject({
	id: kebabIdSchema,
	name: z.string(),
	kind: z.enum(['plant', 'container', 'bed', 'lawn']),
	status: z.enum(['planned', 'planted']),
	tags: z.array(z.string()),
	position: positionSchema.nullable().default(null),
	site: z.string().nullable().default(null),
	lawn: lawnDetailSchema.nullable().default(null),
	notes: z.string().nullable().default(null),
}).refine(
	plant => (plant.kind === 'lawn') === (plant.lawn !== null),
	{ message: 'lawn detail must be present if and only if kind is \'lawn\'', path: ['lawn'] },
);

export type Plant = z.infer<typeof plantSchema>;

/**
 * `overlays` is reserved for shapes drawn on the yard photo later — bed
 * outlines, irrigation coverage. It stays typed as `never[]` and empty
 * because nothing renders them yet, and an empty array is easier to widen
 * than to retrofit. It is not called `zones`: CONTEXT.md's Plant entry lists
 * `zone` as a word to avoid, and a field of that name sitting in the module
 * that owns Plant is exactly the confusion the glossary is guarding.
 */
export const yardSchema = z.strictObject({
	id: kebabIdSchema,
	region: regionSchema,
	photo: z.strictObject({
		path: z.string(),
		width: z.number().int().positive(),
		height: z.number().int().positive(),
	}).nullable().default(null),
	overlays: z.array(z.never()).default([]),
});

export type Yard = z.infer<typeof yardSchema>;
