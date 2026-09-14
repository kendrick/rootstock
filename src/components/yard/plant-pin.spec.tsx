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
	// A real button rather than a div with an onClick, so pointer and touch
	// interaction behave exactly like any other button.
	it('renders a real button, operable by click', () => {
		const onSelect = vi.fn();
		render(<PlantPin plant={figPlant} onSelect={onSelect} />);

		const pin = screen.getByTitle(figPlant.name);
		expect(pin.tagName).toBe('BUTTON');

		pin.click();
		expect(onSelect).toHaveBeenCalledWith(figPlant, pin);
	});

	// The critique found the pin layer and the list exposing the same nine
	// Plants as two independent button sets, so a keyboard or screen-reader
	// user traversed every one of them twice with near-identical labels.
	// `plant-list.tsx` already reaches every Plant, sited or not, and carries
	// more context per row (kind, site) than a pin's bare name; a pin reached
	// by Tab in isolation gives no sense of where on the photo it sits either,
	// so a keyboard user loses nothing real by this. Pointer and touch
	// interaction are untouched: aria-hidden and tabIndex affect neither.
	it('is excluded from the tab order and the accessibility tree, so a plant is not reachable twice', () => {
		render(<PlantPin plant={figPlant} onSelect={vi.fn()} />);

		const pin = screen.getByTitle(figPlant.name);
		expect(pin.tabIndex).toBe(-1);
		expect(pin.getAttribute('aria-hidden')).toBe('true');
	});

	// Position is a fraction because issue #29 replaces the photo at another
	// resolution. A pixel offset computed from photo.width/height looks
	// identical today and moves every pin the day the image changes, so this
	// reads the rendered offset back and holds it to `position.x * 100`.
	it('places the pin at a percentage of the wrapper, not a pixel offset', () => {
		const position = positionOf(figPlant);
		render(<PlantPin plant={figPlant} onSelect={vi.fn()} />);

		const pin = screen.getByTitle(figPlant.name);
		expect(pin.style.left).toBe(`${position.x * 100}%`);
		expect(pin.style.top).toBe(`${position.y * 100}%`);
	});

	// pin-layout.ts nudges a crowded cluster apart for rendering only, and
	// hands the result in here rather than mutating the Plant it came from.
	// onSelect still has to carry the real Plant record, position and all, so
	// the sheet and the store never see a fiction the layout invented.
	it('renders at an overridden position without changing which Plant onSelect receives', () => {
		const onSelect = vi.fn();
		render(<PlantPin plant={figPlant} position={{ x: 0.9, y: 0.1 }} onSelect={onSelect} />);

		const pin = screen.getByTitle(figPlant.name);
		expect(pin.style.left).toBe('90%');
		expect(pin.style.top).toBe('10%');

		pin.click();
		expect(onSelect).toHaveBeenCalledWith(figPlant, pin);
	});

	// A pin anchored by its top-left corner points at a spot down and to the
	// right of the plant it means, and the error grows with the pin.
	it('centres the pin on its own point', () => {
		render(<PlantPin plant={figPlant} onSelect={vi.fn()} />);

		const className = screen.getByTitle(figPlant.name).getAttribute('class') ?? '';
		expect(className).toContain('-translate-x-1/2');
		expect(className).toContain('-translate-y-1/2');
	});

	// An unsited Plant has nowhere to go, and a pin at 0,0 or at the centre
	// would be a confident lie about where it is.
	it('renders nothing for a Plant with no position', () => {
		const { container } = render(<PlantPin plant={unplacedPlantedPlant} onSelect={vi.fn()} />);

		expect(container.firstChild).toBeNull();
		expect(screen.queryByRole('button', { hidden: true })).toBeNull();
	});

	it('renders nothing for a planned Plant the yard has not sited yet', () => {
		const { container } = render(<PlantPin plant={plannedPlant} onSelect={vi.fn()} />);

		expect(container.firstChild).toBeNull();
	});

	// The pin is aria-hidden, so its title (not an accessible name) is what a
	// test, or a sighted mouse user hovering it, has to go on.
	it('says planned in the pin\'s title', () => {
		render(<PlantPin plant={plannedAndSited} onSelect={vi.fn()} />);

		expect(screen.getByTitle(`${plannedAndSited.name}, planned`)).toBeDefined();
		expect(screen.queryByTitle(plannedAndSited.name)).toBeNull();
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

	it('marks the glyph decorative', () => {
		const { container } = render(<PlantPin plant={figPlant} onSelect={vi.fn()} />);

		expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
	});
});
