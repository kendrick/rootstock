import type { Plant } from '@/yard/plant';

/**
 * Plants gathered by the site the owner wrote for them, each site (no site counting as one) in the order it first appears in the inventory. `Yard` numbers the callouts in this order too, so one site's Plants carry a run of numbers on the photo as well as sitting together in the list, and an inventory already written site by site keeps the numbers it had.
 */
export function bySite(plants: Plant[]): { site: string | null; members: Plant[] }[] {
	const groups = new Map<string | null, Plant[]>();
	for (const plant of plants) {
		groups.set(plant.site, [...(groups.get(plant.site) ?? []), plant]);
	}
	return [...groups].map(([site, members]) => ({ site, members }));
}
