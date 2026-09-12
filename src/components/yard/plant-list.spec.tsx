import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { figPlant, lawnPlant, plannedPlant, plantFixtures, unplacedPlantedPlant } from './fixtures';
import { PlantList } from './plant-list';

describe('plantList', () => {
	// The whole reason this list exists is as the equivalent path for a Plant
	// with no pin. A filter on `position` here would silently drop every
	// planned Plant and the one unplaced-but-planted fixture, stranding both
	// with no way into the sheet.
	it('lists every plant, including one with a null position', () => {
		render(<PlantList plants={plantFixtures} onSelect={() => {}} />);

		expect(screen.getAllByRole('listitem')).toHaveLength(plantFixtures.length);
		expect(screen.getByRole('button', { name: new RegExp(unplacedPlantedPlant.name) })).toBeDefined();
	});

	// Mirrors the SourceBadge test for its own colour-only claim: the marker
	// has to be legible as text, not a class name a screen reader and a
	// colour-blind reader on the zinc-only shell both miss.
	it('marks a planned plant with visible text, not styling alone', () => {
		render(<PlantList plants={[plannedPlant]} onSelect={() => {}} />);

		expect(screen.getByText('Planned')).toBeDefined();
	});

	it('does not mark a planted plant as planned', () => {
		render(<PlantList plants={[figPlant]} onSelect={() => {}} />);

		expect(screen.queryByText('Planned')).toBeNull();
	});

	// Two containers on the same patio (the seed's hibiscus pair) are only
	// told apart by kind and site, so a row that dropped either would leave a
	// reader unable to tell which button opens which plant.
	it('shows kind and site alongside the name when site is present', () => {
		render(<PlantList plants={[figPlant]} onSelect={() => {}} />);

		const row = screen.getByRole('button', { name: new RegExp(figPlant.name) });
		expect(row.textContent).toContain('Plant');
		expect(row.textContent).toContain(figPlant.site);
	});

	it('omits the site line for a plant with none, without inventing one', () => {
		render(<PlantList plants={[lawnPlant]} onSelect={() => {}} />);

		const row = screen.getByRole('button', { name: new RegExp(lawnPlant.name) });
		expect(row.textContent).toContain('Lawn');
		expect(lawnPlant.site).toBeNull();
	});

	// One control per row: a real <button>, not a click handler on the <li>,
	// so the row is reachable by keyboard and reads its name to a screen
	// reader on its own.
	it('gives each row a real button carrying the plant name as its accessible name', () => {
		render(<PlantList plants={[figPlant]} onSelect={() => {}} />);

		expect(screen.getByRole('button', { name: new RegExp(figPlant.name) })).toBeDefined();
	});

	it('calls onSelect with the plant whose row was clicked, not another one', () => {
		const onSelect = vi.fn();
		render(<PlantList plants={[figPlant, lawnPlant]} onSelect={onSelect} />);

		fireEvent.click(screen.getByRole('button', { name: new RegExp(lawnPlant.name) }));

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith(lawnPlant);
	});

	// A `<ul>`/`<li>` structure, not a stack of divs, so assistive tech
	// announces the count. `aria-label` gives that list an accessible name
	// rather than leaving it anonymous among other lists on the page.
	it('renders a real list with an accessible name', () => {
		render(<PlantList plants={plantFixtures} onSelect={() => {}} />);

		expect(screen.getByRole('list', { name: 'Plants' })).toBeDefined();
	});
});
