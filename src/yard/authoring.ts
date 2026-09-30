/*
 * Adding a Plant to the inventory, as pure functions over the seed's own text.
 *
 * `plants.json` is the documented add-a-plant path (CONTEXT.md, Seed data), so the work here is making that file easy to extend correctly: mint an id nobody has to invent, suggest the tags and sites already in use, say which Rules the new Plant will reach before it is written, and append it without reflowing the rest of the file.
 *
 * Nothing here touches the filesystem, so the same functions serve `scripts/plant.ts` today and a local add-plant page later. That page must stay local, like the siting page in `scripts/site-plants.ts`. The published site is a static export with no server, and an editing affordance shipped inside it would be reachable by anyone who found the URL. A local page takes a draft through `plantDraftSchema`, `draftToPlant`, and `previewReach`, then hands `insertPlant`'s result to a local process that writes the file.
 */
import type { Rule } from '@/rules/rule';
import type { Plant, Position } from '@/yard/plant';
import { z } from 'zod';
import { targets } from '@/planner/targets';
import { parseWith } from '@/validation/parse';
import { lawnDetailSchema, plantSchema } from '@/yard/plant';

/**
 * What a person supplies to add a Plant. The id is minted by {@link mintPlantId} rather than typed, and the Pin is placed afterwards by clicking the photo (`pnpm site-plants`), so neither is asked for here.
 */
export const plantDraftSchema = z.strictObject({
	name: z.string().trim().min(1),
	species: z.string().trim().min(1).nullable().default(null),
	kind: plantSchema.shape.kind,
	status: plantSchema.shape.status,
	tags: z.array(z.string().trim().min(1)).default([]),
	site: z.string().trim().min(1).nullable().default(null),
	lawn: lawnDetailSchema.nullable().default(null),
	notes: z.string().trim().min(1).nullable().default(null),
}).refine(
	draft => (draft.kind === 'lawn') === (draft.lawn !== null),
	{ message: 'lawn detail must be present if and only if kind is \'lawn\'', path: ['lawn'] },
);

export type PlantDraft = z.infer<typeof plantDraftSchema>;

/**
 * A kebab id from a Plant's name, suffixed `-2`, `-3` and so on past any id already taken.
 *
 * `taken` should hold every id in the seed, Rules and Occurrences included, because `findDuplicateIds` treats the three lists as one id space. An id is minted once and never edited afterwards: Occurrence history in the seed and in every browser's Store is keyed by it.
 */
export function mintPlantId(name: string, taken: Iterable<string>): string {
	const base = name
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/['\u2019]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'plant';
	const used = new Set(taken);

	if (!used.has(base)) {
		return base;
	}

	let suffix = 2;
	while (used.has(`${base}-${suffix}`)) {
		suffix += 1;
	}
	return `${base}-${suffix}`;
}

export function draftToPlant(draft: PlantDraft, taken: Iterable<string>): Plant {
	return plantSchema.parse({
		id: mintPlantId(draft.name, taken),
		name: draft.name,
		species: draft.species,
		kind: draft.kind,
		status: draft.status,
		tags: draft.tags,
		position: null,
		site: draft.site,
		lawn: draft.lawn,
		notes: draft.notes,
	});
}

export interface TagInUse {
	tag: string;
	/** How many Plants carry the tag. */
	plants: number;
	/** The task-creating Rules that select Plants by this tag. */
	ruleIds: string[];
}

export interface AuthoringVocabulary {
	/** Tags a Rule selects on come first, since those are the ones that change what gets planned. */
	tags: TagInUse[];
	/** Every site already written, so a new Plant can reuse the spelling instead of starting a near-duplicate. */
	sites: string[];
}

export function authoringVocabulary(plants: Plant[], rules: Rule[]): AuthoringVocabulary {
	const counts = new Map<string, number>();
	const selectors = new Map<string, string[]>();

	for (const plant of plants) {
		for (const tag of plant.tags) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}

	for (const rule of rules) {
		if (rule.kind === 'guard') {
			continue;
		}
		for (const tag of rule.appliesTo.plantTags ?? []) {
			selectors.set(tag, [...(selectors.get(tag) ?? []), rule.id]);
			counts.set(tag, counts.get(tag) ?? 0);
		}
	}

	const tags = [...counts].map(([tag, count]) => ({ tag, plants: count, ruleIds: selectors.get(tag) ?? [] }));
	tags.sort((left, right) =>
		Number(right.ruleIds.length > 0) - Number(left.ruleIds.length > 0)
		|| right.plants - left.plants
		|| left.tag.localeCompare(right.tag));

	const sites = [...new Set(plants.flatMap(plant => plant.site === null ? [] : [plant.site]))].sort((left, right) => left.localeCompare(right));

	return { tags, sites };
}

export interface Reach {
	/** The task-creating Rules that would plan work for this Plant once it is planted. */
	rules: { id: string; name: string }[];
	/** False for a planned Plant, which `targets()` skips until it goes in the ground. */
	now: boolean;
}

/**
 * Which Rules a Plant reaches, answered by `targets()` itself so the preview cannot drift from the Planner.
 *
 * A whole-yard Rule is left out: it plans one Task for the yard rather than one for this Plant, so adding a Plant never changes it. Reaching nothing is information, not an error. A native bed nobody feeds is a real Plant that no Rule should reach.
 */
export function previewReach(plant: Plant, rules: Rule[]): Reach {
	const asPlanted: Plant = { ...plant, status: 'planted' };
	const reaching = rules.filter((rule) => {
		if (rule.kind === 'guard') {
			return false;
		}
		const { plants } = targets(rule, [asPlanted]);
		return plants !== null && plants.length > 0;
	});

	return { rules: reaching.map(rule => ({ id: rule.id, name: rule.name })), now: plant.status === 'planted' };
}

function formatPosition(position: Position | null): string {
	return position === null ? 'null' : `{ "x": ${position.x}, "y": ${position.y} }`;
}

/**
 * One Plant in the house format of `plants.json`: a field per line, tags and position inline, lawn detail nested. `authoring.spec.ts` holds this to reproducing every committed record byte for byte, which is what keeps an appended Plant from looking different to the ones typed by hand.
 */
export function formatPlant(plant: Plant): string {
	const text = JSON.stringify;
	const lawn = plant.lawn === null
		? 'null'
		: [
				'{',
				`\t\t\t"grass": ${text(plant.lawn.grass)},`,
				`\t\t\t"areaSqFt": ${plant.lawn.areaSqFt},`,
				`\t\t\t"soil": ${text(plant.lawn.soil)},`,
				'\t\t\t"irrigation": {',
				`\t\t\t\t"schedule": ${text(plant.lawn.irrigation.schedule)},`,
				`\t\t\t\t"source": ${text(plant.lawn.irrigation.source)}`,
				'\t\t\t}',
				'\t\t}',
			].join('\n');

	return [
		'\t{',
		`\t\t"id": ${text(plant.id)},`,
		`\t\t"name": ${text(plant.name)},`,
		`\t\t"species": ${plant.species === null ? 'null' : text(plant.species)},`,
		`\t\t"kind": ${text(plant.kind)},`,
		`\t\t"status": ${text(plant.status)},`,
		`\t\t"tags": [${plant.tags.map(tag => text(tag)).join(', ')}],`,
		`\t\t"position": ${formatPosition(plant.position)},`,
		`\t\t"site": ${plant.site === null ? 'null' : text(plant.site)},`,
		`\t\t"lawn": ${lawn},`,
		`\t\t"notes": ${plant.notes === null ? 'null' : text(plant.notes)}`,
		'\t}',
	].join('\n');
}

/**
 * Appends a Plant to the text of `plants.json`, leaving every existing byte where it was, then parses the result the way `@/seed` will so a bad append fails here instead of at the next import.
 */
export function insertPlant(source: string, plant: Plant): string {
	const close = source.lastIndexOf(']');

	if (close === -1) {
		throw new Error('plants.json has no closing bracket, so there is no array to append to');
	}

	const lastRecord = source.lastIndexOf('}', close);

	const updated = lastRecord === -1
		? `${source.slice(0, close).trimEnd()}\n${formatPlant(plant)}\n${source.slice(close)}`
		: `${source.slice(0, lastRecord + 1)},\n${formatPlant(plant)}${source.slice(lastRecord + 1)}`;

	const plants = parseWith(z.array(plantSchema), 'plants.json')(JSON.parse(updated));
	const ids = plants.map(each => each.id);
	const repeated = ids.find((id, index) => ids.indexOf(id) !== index);

	if (repeated !== undefined) {
		throw new Error(`plants.json would carry the id '${repeated}' twice`);
	}

	return updated;
}

export interface Siting {
	id: string;
	position: Position | null;
}

/**
 * Applies Pin placements to the text of `plants.json` rather than through a parse and a re-serialise. Round-tripping through `JSON.stringify` would reflow every record in the file to make one number move, and the diff would hide the change it was meant to show.
 */
export function applySitings(source: string, sitings: Siting[]): string {
	let updated = source;

	for (const { id, position } of sitings) {
		const idAnchor = `"id": "${id}"`;
		const start = updated.indexOf(idAnchor);

		if (start === -1) {
			throw new Error(`no Plant with id '${id}' in plants.json`);
		}

		const positionKey = updated.indexOf('"position":', start);

		if (positionKey === -1) {
			throw new Error(`Plant '${id}' has no position field to write to`);
		}

		const lineEnd = updated.indexOf('\n', positionKey);
		const line = updated.slice(positionKey, lineEnd);
		const trailingComma = line.trimEnd().endsWith(',') ? ',' : '';

		updated = `${updated.slice(0, positionKey)}"position": ${formatPosition(position)}${trailingComma}${updated.slice(lineEnd)}`;
	}

	return updated;
}
