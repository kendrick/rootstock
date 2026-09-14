import type { Plant, Position } from '@/yard/plant';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { figPlant, plannedPlant, unplacedPlantedPlant } from './fixtures';
import { PlantPin } from './plant-pin';

function positionOf(plant: Plant): Position {
	if (plant.position === null) {
		throw new Error(`fixture '${plant.id}' carries no position: this test has nothing to assert against.`);
	}
	return plant.position;
}

/*
 * Every planned plant the seed ships is unsited, so no fixture covers the case
 * this file needs: a planned Plant that does have a spot on the photo. The
 * schema allows one, and the yard produces one the moment somebody decides
 * where the crossvine goes. It is built here the way fixtures.ts builds its own
 * gap-filler, spread from a real record with only the field under test changed.
 */
const plannedAndSited: Plant = { ...plannedPlant, position: { x: 0.12, y: 0.34 } };

describe('plantPin', () => {
	// A div with an onClick looks identical on screen and no keyboard can reach
	// it. The role would not catch that, since `role="button"` on a div
	// satisfies it, so this reads the tag name.
	it('renders a real button, focusable and operable from the keyboard', () => {
		const onSelect = vi.fn();
		render(<PlantPin plant={figPlant} onSelect={onSelect} />);

		const pin = screen.getByRole('button', { name: figPlant.name });
		expect(pin.tagName).toBe('BUTTON');

		pin.focus();
		expect(document.activeElement).toBe(pin);

		// The DOM click a native button fires on Enter and on Space.
		pin.click();
		expect(onSelect).toHaveBeenCalledWith(figPlant, expect.any(HTMLElement));
	});

	// Position is a fraction because issue #29 replaces the photo at another
	// resolution. A pixel offset computed from photo.width/height looks
	// identical today and moves every pin the day the image changes, so this
	// reads the rendered offset back and holds it to `position.x * 100`.
	it('places the pin at a percentage of the wrapper, not a pixel offset', () => {
		const position = positionOf(figPlant);
		render(<PlantPin plant={figPlant} onSelect={vi.fn()} />);

		const pin = screen.getByRole('button', { name: figPlant.name });
		expect(pin.style.left).toBe(`${position.x * 100}%`);
		expect(pin.style.top).toBe(`${position.y * 100}%`);
	});

	// A pin anchored by its top-left corner points at a spot down and to the
	// right of the plant it means, and the error grows with the pin.
	it('centres the pin on its own point', () => {
		render(<PlantPin plant={figPlant} onSelect={vi.fn()} />);

		const className = screen.getByRole('button', { name: figPlant.name }).getAttribute('class') ?? '';
		expect(className).toContain('-translate-x-1/2');
		expect(className).toContain('-translate-y-1/2');
	});

	// An unsited Plant has nowhere to go, and a pin at 0,0 or at the centre
	// would be a confident lie about where it is.
	it('renders nothing for a Plant with no position', () => {
		const { container } = render(<PlantPin plant={unplacedPlantedPlant} onSelect={vi.fn()} />);

		expect(container.firstChild).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('renders nothing for a planned Plant the yard has not sited yet', () => {
		const { container } = render(<PlantPin plant={plannedPlant} onSelect={vi.fn()} />);

		expect(container.firstChild).toBeNull();
	});

	// A screen reader hears the accessible name and nothing else, so "planned"
	// has to be in it. A class check would pass a treatment only a sighted
	// reader can see, so this reads the name.
	it('says planned in the accessible name of a planned Plant', () => {
		render(<PlantPin plant={plannedAndSited} onSelect={vi.fn()} />);

		expect(screen.getByRole('button', { name: `${plannedAndSited.name}, planned` })).toBeDefined();
		expect(screen.queryByRole('button', { name: plannedAndSited.name })).toBeNull();
	});

	// The shell is one zinc scale and the yard gets read on a phone in daylight,
	// so colour was never going to carry this on its own. lucide stamps each
	// icon's name onto the svg, which proves the two states draw genuinely
	// different glyphs rather than the same disc in another shade.
	it('draws a different glyph and fill for planned than for planted', () => {
		const { container: plantedContainer } = render(<PlantPin plant={figPlant} onSelect={vi.fn()} />);
		const { container: plannedContainer } = render(<PlantPin plant={plannedAndSited} onSelect={vi.fn()} />);

		const plantedIcon = plantedContainer.querySelector('svg')?.getAttribute('class') ?? '';
		const plannedIcon = plannedContainer.querySelector('svg')?.getAttribute('class') ?? '';

		expect(plantedIcon).toContain('lucide-circle');
		expect(plantedIcon).not.toContain('lucide-circle-dashed');
		expect(plannedIcon).toContain('lucide-circle-dashed');

		// Solid disc for what is in the ground, open one for what is not.
		expect(plantedIcon).toContain('fill-current');
		expect(plannedIcon).toContain('fill-none');
	});

	it('hides the glyph from screen readers so the name is not announced twice', () => {
		const { container } = render(<PlantPin plant={figPlant} onSelect={vi.fn()} />);

		expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
	});
});
