import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { figPlant, lawnPlant, plannedPlant, plantFixtures, unplacedPlantedPlant } from './fixtures';
import { PlantList } from './plant-list';

/**
 * The numbering the component would receive from `Yard`: the parts list's own
 * order. Declared here so a call site reads as one Plant rather than as a Map
 * literal, and so a change to how the numbering is derived lands in one place.
 */
function ordinalsFor(plants: { id: string }[]): ReadonlyMap<string, number> {
	return new Map(plants.map((plant, index) => [plant.id, index + 1]));
}

describe('plantList', () => {
	// The whole reason this list exists is as the equivalent path for a Plant
	// with no pin. A filter on `position` here would silently drop every
	// planned Plant and the one unplaced-but-planted fixture, stranding both
	// with no way into the sheet.
	it('lists every plant, including one with a null position', () => {
		render(<PlantList plants={plantFixtures} ordinals={ordinalsFor(plantFixtures)} hovered={null} onHoverChange={() => {}} onSelect={() => {}} />);

		expect(screen.getAllByRole('listitem')).toHaveLength(plantFixtures.length);
		expect(screen.getByRole('button', { name: new RegExp(unplacedPlantedPlant.name) })).toBeDefined();
	});

	// Mirrors the SourceBadge test for its own colour-only claim: the marker
	// has to be legible as text, not a class name a screen reader and a
	// colour-blind reader on the zinc-only shell both miss.
	it('marks a planned plant with visible text, not styling alone', () => {
		render(<PlantList plants={[plannedPlant]} ordinals={ordinalsFor([plannedPlant])} hovered={null} onHoverChange={() => {}} onSelect={() => {}} />);

		expect(screen.getByText('Planned')).toBeDefined();
	});

	it('does not mark a planted plant as planned', () => {
		render(<PlantList plants={[figPlant]} ordinals={ordinalsFor([figPlant])} hovered={null} onHoverChange={() => {}} onSelect={() => {}} />);

		expect(screen.queryByText('Planned')).toBeNull();
	});

	// Two containers on the same patio (the seed's hibiscus pair) are only
	// told apart by kind and site, so a row that dropped either would leave a
	// reader unable to tell which button opens which plant.
	it('shows kind and site alongside the name when site is present', () => {
		render(<PlantList plants={[figPlant]} ordinals={ordinalsFor([figPlant])} hovered={null} onHoverChange={() => {}} onSelect={() => {}} />);

		const row = screen.getByRole('button', { name: new RegExp(figPlant.name) });
		expect(row.textContent).toContain('Plant');
		expect(row.textContent).toContain(figPlant.site);
	});

	it('omits the site line for a plant with none, without inventing one', () => {
		render(<PlantList plants={[lawnPlant]} ordinals={ordinalsFor([lawnPlant])} hovered={null} onHoverChange={() => {}} onSelect={() => {}} />);

		const row = screen.getByRole('button', { name: new RegExp(lawnPlant.name) });
		expect(row.textContent).toContain('Lawn');
		expect(lawnPlant.site).toBeNull();
	});

	// One control per row: a real <button>, not a click handler on the <li>,
	// so the row is reachable by keyboard and reads its name to a screen
	// reader on its own.
	it('gives each row a real button carrying the plant name as its accessible name', () => {
		render(<PlantList plants={[figPlant]} ordinals={ordinalsFor([figPlant])} hovered={null} onHoverChange={() => {}} onSelect={() => {}} />);

		expect(screen.getByRole('button', { name: new RegExp(figPlant.name) })).toBeDefined();
	});

	it('calls onSelect with the plant whose row was clicked, not another one', () => {
		const onSelect = vi.fn();
		render(<PlantList plants={[figPlant, lawnPlant]} ordinals={ordinalsFor([figPlant, lawnPlant])} hovered={null} onHoverChange={() => {}} onSelect={onSelect} />);

		fireEvent.click(screen.getByRole('button', { name: new RegExp(lawnPlant.name) }));

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith(lawnPlant, expect.any(HTMLElement));
	});

	// A `<ul>`/`<li>` structure, not a stack of divs, so assistive tech
	// announces the count. `aria-label` gives that list an accessible name
	// rather than leaving it anonymous among other lists on the page.
	it('renders a real list with an accessible name', () => {
		render(<PlantList plants={plantFixtures} ordinals={ordinalsFor(plantFixtures)} hovered={null} onHoverChange={() => {}} onSelect={() => {}} />);

		expect(screen.getByRole('list', { name: 'Plants' })).toBeDefined();
	});

	/*
	 * The week view files each Plant under what it needs. An unreached Plant
	 * (no Rule will ever give it a Task) must not share a group with one whose
	 * Rules are merely quiet, or the list tells the owner "fine for now" about
	 * a Plant the system never looks at.
	 */
	describe('the week view', () => {
		const plants = [lawnPlant, figPlant, unplacedPlantedPlant, plannedPlant];
		const lines = new Map([[lawnPlant.id, [{ group: 'Ready now' as const, ordinal: 1, ruleId: 'rule-a' }]]]);
		const standings = new Map([
			[lawnPlant.id, 'reached' as const],
			[figPlant.id, 'reached' as const],
			[unplacedPlantedPlant.id, 'unreached' as const],
			[plannedPlant.id, 'planned' as const],
		]);
		const renderWeek = () => render(
			<PlantList plants={plants} ordinals={ordinalsFor(plants)} hovered={null} onHoverChange={() => {}} onSelect={() => {}} lines={lines} ruleNames={new Map([['rule-a', 'Rule A']])} view="week" standings={standings} />,
		);

		it('prints the work first, then the unreached, the quiet and the planned', () => {
			renderWeek();

			const printed = [...screen.getByRole('list', { name: 'Plants' }).children].map(item => item.getAttribute('aria-hidden') === 'true' ? item.textContent : `row:${item.textContent?.includes(lawnPlant.name) ? 'lawn' : item.textContent?.includes(figPlant.name) ? 'fig' : item.textContent?.includes(unplacedPlantedPlant.name) ? 'unplaced' : 'planned'}`);

			expect(printed).toEqual([
				'On this week\'s ticket',
				'row:lawn',
				'No Rule reaches these',
				'row:unplaced',
				'Quiet this week',
				'row:fig',
				'Planned',
				'row:planned',
			]);
		});

		it('gives each row its reason in words, where the heads are hidden from a screen reader', () => {
			renderWeek();

			expect(screen.getAllByRole('listitem')).toHaveLength(plants.length);
			expect(screen.getByRole('button', { name: /No Rule reaches this plant, so it never gets a Task\./u }).textContent).toContain(unplacedPlantedPlant.name);
			expect(screen.getByRole('button', { name: new RegExp(`${figPlant.name}.*Nothing on this week's ticket\\.`, 'u') })).toBeDefined();
		});
	});

	// The inventory has no group heads, so the gap has to be on the row itself.
	it('names an unreached Plant on its row in the inventory view', () => {
		render(<PlantList plants={[unplacedPlantedPlant]} ordinals={ordinalsFor([unplacedPlantedPlant])} hovered={null} onHoverChange={() => {}} onSelect={() => {}} view="all" standings={new Map([[unplacedPlantedPlant.id, 'unreached' as const]])} />);

		expect(screen.getByText('No Rule reaches this plant, so it never gets a Task.').className).not.toContain('sr-only');
	});

	// The plate's numbers are visual, so a screen reader user following a
	// sighted partner's "number 2" needs the number in the row's name.
	it('says each row\'s number in its name, after the Plant', () => {
		render(<PlantList plants={[lawnPlant, figPlant]} ordinals={ordinalsFor([lawnPlant, figPlant])} hovered={null} onHoverChange={() => {}} onSelect={() => {}} />);

		expect(screen.getByRole('button', { name: new RegExp(`^${figPlant.name}, number 2`, 'u') })).toBeDefined();
	});
});
