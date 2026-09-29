import { describe, expect, it } from 'vitest';
import { bySite } from './by-site';
import { figPlant } from './fixtures';

describe('bySite', () => {
	const patio = (id: string, site: string | null) => ({ ...figPlant, id, name: id, site });
	const plants = [patio('a', 'Back patio'), patio('b', null), patio('c', 'Front bed'), patio('d', 'Back patio'), patio('e', null)];

	it('gathers Plants by site, each site where it first appears', () => {
		expect(bySite(plants).map(group => [group.site, group.members.map(plant => plant.id)])).toEqual([
			['Back patio', ['a', 'd']],
			[null, ['b', 'e']],
			['Front bed', ['c']],
		]);
	});
});
