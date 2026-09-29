import type { Plant } from '@/yard/plant';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seedPlants, seedRules } from '@/seed';
import { kebabIdSchema } from '@/validation/ids';
import { plantSchema } from '@/yard/plant';
import { authoringVocabulary, draftToPlant, formatPlant, insertPlant, mintPlantId, plantDraftSchema, previewReach } from './authoring';

const PLANTS_JSON = readFileSync(join(import.meta.dirname, '..', 'seed', 'plants.json'), 'utf8');

function draft(overrides: Record<string, unknown> = {}) {
	return plantDraftSchema.parse({ name: 'Coral honeysuckle', kind: 'plant', status: 'planted', tags: ['vine', 'native'], ...overrides });
}

describe('formatPlant', () => {
	// The consumer here is a person reading a diff of plants.json, so the check is against the committed file itself rather than against a format written down in this spec.
	it('rebuilds the committed plants.json byte for byte from its parsed records', () => {
		expect(`[\n${seedPlants.map(formatPlant).join(',\n')}\n]\n`).toBe(PLANTS_JSON);
	});
});

describe('insertPlant', () => {
	const added = draftToPlant(draft(), seedPlants.map(p => p.id));

	it('appends one Plant that @/seed parses, with every existing record unchanged', () => {
		const updated = insertPlant(PLANTS_JSON, added);
		const parsed = plantSchema.array().parse(JSON.parse(updated));

		expect(parsed).toEqual([...seedPlants, added]);
	});

	it('leaves every byte before the appended record where it was', () => {
		const updated = insertPlant(PLANTS_JSON, added);
		const lastRecordEnd = PLANTS_JSON.lastIndexOf('}') + 1;

		expect(updated.slice(0, lastRecordEnd)).toBe(PLANTS_JSON.slice(0, lastRecordEnd));
		expect(updated.endsWith('\n]\n')).toBe(true);
	});

	it('appends to an empty inventory', () => {
		expect(plantSchema.array().parse(JSON.parse(insertPlant('[]\n', added)))).toEqual([added]);
	});

	it('refuses a Plant whose id the file already carries', () => {
		expect(() => insertPlant(PLANTS_JSON, { ...added, id: 'fig-1' })).toThrow(/'fig-1' twice/);
	});
});

describe('mintPlantId', () => {
	it.each([
		['Coral honeysuckle', 'coral-honeysuckle'],
		['Mexican bush sage (Salvia leucantha)', 'mexican-bush-sage-salvia-leucantha'],
		['Señorita rose', 'senorita-rose'],
		['Turk\u2019s cap', 'turks-cap'],
		['  Turk\'s cap  ', 'turks-cap'],
		['!!!', 'plant'],
	])('mints %j as %j', (name, id) => {
		expect(mintPlantId(name, [])).toBe(id);
		expect(kebabIdSchema.safeParse(id).success).toBe(true);
	});

	it('suffixes past every id already taken, whichever list it came from', () => {
		expect(mintPlantId('Esperanza', ['esperanza'])).toBe('esperanza-2');
		expect(mintPlantId('Esperanza', ['esperanza', 'esperanza-2'])).toBe('esperanza-3');
		expect(mintPlantId('Last nitrogen', seedRules.map(rule => rule.id))).toBe('last-nitrogen-2');
	});
});

describe('plantDraftSchema', () => {
	it('trims what a person typed and defaults what they skipped', () => {
		expect(draft({ name: '  Turk\'s cap ', tags: [' native '] })).toMatchObject({ name: 'Turk\'s cap', tags: ['native'], site: null, notes: null, lawn: null });
	});

	it('requires lawn detail exactly when the kind is lawn', () => {
		expect(plantDraftSchema.safeParse({ name: 'Back lawn', kind: 'lawn', status: 'planted' }).success).toBe(false);
		expect(plantDraftSchema.safeParse({ name: 'Fig', kind: 'plant', status: 'planted', lawn: seedPlants[0]!.lawn }).success).toBe(false);
	});
});

describe('previewReach', () => {
	const withTags = (tags: string[], status: Plant['status'] = 'planted') => draftToPlant(draft({ tags, status }), []);

	it('names every lawn Rule for a Plant tagged lawn', () => {
		expect(previewReach(withTags(['lawn']), seedRules)).toEqual({
			rules: [
				{ id: 'fall-pre-emergent', name: expect.any(String) },
				{ id: 'last-nitrogen', name: expect.any(String) },
				{ id: 'spring-pre-emergent', name: expect.any(String) },
				{ id: 'spring-pre-emergent-follow-up', name: expect.any(String) },
			],
			now: true,
		});
	});

	it('reports a planned Plant\'s Rules as reaching it once planted, not now', () => {
		const reach = previewReach(withTags(['lawn'], 'planned'), seedRules);

		expect(reach.now).toBe(false);
		expect(reach.rules).toHaveLength(4);
	});

	// The Esperanza and fig Rules name their Plants by id, so a new container or fruit tree reaches neither until a Rule selects its tag.
	it('reaches nothing for a Plant whose tags no Rule selects', () => {
		expect(previewReach(withTags(['container', 'fruit', 'native']), seedRules).rules).toEqual([]);
	});
});

describe('authoringVocabulary', () => {
	const vocabulary = authoringVocabulary(seedPlants, seedRules);

	it('leads with the tags a Rule selects on, naming those Rules', () => {
		expect(vocabulary.tags[0]).toEqual({
			tag: 'lawn',
			plants: 1,
			ruleIds: ['fall-pre-emergent', 'last-nitrogen', 'spring-pre-emergent', 'spring-pre-emergent-follow-up'],
		});
	});

	it('lists every tag a Plant carries, once', () => {
		const tags = vocabulary.tags.map(entry => entry.tag);

		expect(new Set(tags)).toEqual(new Set(seedPlants.flatMap(p => p.tags)));
		expect(tags).toHaveLength(new Set(tags).size);
	});

	it('lists each written site once, sorted', () => {
		const sites = [...new Set(seedPlants.flatMap(p => p.site ?? []))].sort((left, right) => left.localeCompare(right));

		expect(vocabulary.sites).toEqual(sites);
	});
});
