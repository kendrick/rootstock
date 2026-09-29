import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { seedPlants, seedRules } from '../src/seed';
import { checkReport, describeReach, parseArgs, parseStatus, parseTags, pickOne, pickOrType } from './plant';

describe('parseArgs', () => {
	it('defaults to the seed inventory', () => {
		expect(parseArgs(['check']).plants).toBe(path.resolve(import.meta.dirname, '../src/seed/plants.json'));
	});

	it('works on a copy when given --plants', () => {
		expect(parseArgs(['add', '--plants', '/tmp/plants.json'])).toEqual({ command: 'add', plants: '/tmp/plants.json' });
	});

	it('refuses an unknown command or a bare --plants', () => {
		expect(() => parseArgs(['remove'])).toThrow(/usage/);
		expect(() => parseArgs(['add', '--plants'])).toThrow(/needs a path/);
	});
});

describe('answers', () => {
	// Rules match tags by exact string, so `Lawn` and `lawn ` would each reach nothing.
	it('reads tags as exact, lowercase, and unrepeated', () => {
		expect(parseTags(' Lawn, turf ,,lawn')).toEqual(['lawn', 'turf']);
		expect(parseTags('')).toEqual([]);
	});

	it('reads a site as a numbered pick, new text, or nothing', () => {
		const sites = ['Back patio', 'Porch trellis'];

		expect(pickOrType('2', sites)).toBe('Porch trellis');
		expect(pickOrType('Front bed', sites)).toBe('Front bed');
		expect(pickOrType('3', sites)).toBe('3');
		expect(pickOrType('  ', sites)).toBeNull();
	});

	it('reads a kind from its first letters', () => {
		const kinds = ['plant', 'container', 'bed', 'lawn'];

		expect(pickOne('c', kinds)).toBe('container');
		expect(pickOne('P', kinds)).toBe('plant');
		expect(pickOne('x', kinds)).toBeUndefined();
		expect(pickOne('', kinds)).toBeUndefined();
	});

	it('reads [p]lanted as planted, never planned', () => {
		expect(parseStatus('p')).toBe('planted');
		expect(parseStatus('n')).toBe('planned');
		expect(parseStatus('pl')).toBeUndefined();
	});
});

describe('describeReach', () => {
	it('says plainly when no Rule reaches a Plant', () => {
		expect(describeReach({ rules: [], now: true })).toMatch(/^No Rule reaches it/);
	});

	it('says a planned Plant is reached once planted', () => {
		expect(describeReach({ rules: [{ id: 'last-nitrogen', name: 'Last nitrogen' }], now: false })).toBe('Rules that will plan work for it once it is planted:\n  - Last nitrogen (last-nitrogen)');
	});
});

describe('checkReport', () => {
	it('finds nothing to fix in the shipped seed', () => {
		expect(checkReport(seedPlants, seedRules).problems).toBe(0);
	});

	it('flags a planted Plant with no Pin and no note, and lets a note excuse it', () => {
		const unsited = { ...seedPlants[1], id: 'new-shrub', position: null, notes: null };
		const report = checkReport([...seedPlants, unsited], seedRules);

		expect(report.problems).toBe(1);
		expect(report.lines).toContain('  ! no Pin and no note saying why. Run `pnpm site-plants --only new-shrub`, or add a note');
		expect(checkReport([...seedPlants, { ...unsited, notes: 'Behind the house, off the photo' }], seedRules).problems).toBe(0);
	});

	// The lawn Rules include a pre-emergent herbicide, so a `lawn` tag on anything else is the costliest typo the inventory can carry.
	it('flags the lawn tag on a Plant that isn\'t a lawn, and a lawn without it', () => {
		const hibiscus = { ...seedPlants.find(plant => plant.id === 'hibiscus-luna-white'), tags: ['container', 'lawn'] };
		const bareLawn = { ...seedPlants.find(plant => plant.id === 'front-lawn'), id: 'back-lawn', tags: ['turf'] };
		const { lines, problems } = checkReport([...seedPlants.filter(plant => plant.id !== hibiscus.id), hibiscus, bareLawn], seedRules);

		expect(problems).toBe(2);
		expect(lines).toContain('! plant \'hibiscus-luna-white\' carries the \'lawn\' tag but is a container, so every lawn Rule would reach it');
		expect(lines).toContain('! plant \'back-lawn\' is a lawn but lacks the \'lawn\' tag the lawn Rules select on');
	});

	it('flags a Rule selecting a tag no Plant carries', () => {
		const lawnless = seedPlants.filter(plant => !plant.tags.includes('lawn'));

		expect(checkReport(lawnless, seedRules).lines).toContain('! rule \'last-nitrogen\' appliesTo.plantTags names tag \'lawn\', which no plant carries');
	});
});
