import type { Plant, Position } from '@/yard/plant';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
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

/**
 * Radix requires a provider above every tooltip, and the callout carries one.
 * `Yard` supplies it on the real surface; these render the pin on its own, so
 * the wrapper stands in for it.
 */
const withTooltip = { wrapper: TooltipProvider } as const;

/**
 * The callout for one Plant. It is aria-hidden by design, so it has no
 * accessible name to query by; `data-plant` is what identifies it.
 */
function pinFor(plantId: string): HTMLElement {
	const pin = document.querySelector<HTMLElement>(`[data-plant="${plantId}"]`);

	if (pin === null) {
		throw new Error(`no callout rendered for '${plantId}'`);
	}

	return pin;
}

describe('plantPin', () => {
	// A real button rather than a div with an onClick, so pointer and touch
	// interaction behave exactly like any other button.
	it('renders a real button, operable by click', () => {
		const onSelect = vi.fn();
		render(<PlantPin plant={figPlant} ordinal={1} hovered={false} onHoverChange={() => {}} onSelect={onSelect} />, withTooltip);

		const pin = pinFor(figPlant.id);
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
		render(<PlantPin plant={figPlant} ordinal={1} hovered={false} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		const pin = pinFor(figPlant.id);
		expect(pin.tabIndex).toBe(-1);
		expect(pin.getAttribute('aria-hidden')).toBe('true');
	});

	// Position is a fraction because issue #29 replaces the photo at another
	// resolution. A pixel offset computed from photo.width/height looks
	// identical today and moves every pin the day the image changes, so this
	// reads the rendered offset back and holds it to `position.x * 100`.
	it('places the pin at a percentage of the wrapper, not a pixel offset', () => {
		const position = positionOf(figPlant);
		render(<PlantPin plant={figPlant} ordinal={1} hovered={false} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		const pin = pinFor(figPlant.id);
		expect(pin.style.left).toBe(`${position.x * 100}%`);
		expect(pin.style.top).toBe(`${position.y * 100}%`);
	});

	// pin-layout.ts nudges a crowded cluster apart for rendering only, and
	// hands the result in here rather than mutating the Plant it came from.
	// onSelect still has to carry the real Plant record, position and all, so
	// the sheet and the store never see a fiction the layout invented.
	it('renders at an overridden position without changing which Plant onSelect receives', () => {
		const onSelect = vi.fn();
		render(<PlantPin plant={figPlant} ordinal={1} position={{ x: 0.9, y: 0.1 }} hovered={false} onHoverChange={() => {}} onSelect={onSelect} />, withTooltip);

		const pin = pinFor(figPlant.id);
		expect(pin.style.left).toBe('90%');
		expect(pin.style.top).toBe('10%');

		pin.click();
		expect(onSelect).toHaveBeenCalledWith(figPlant, pin);
	});

	// A pin anchored by its top-left corner points at a spot down and to the
	// right of the plant it means, and the error grows with the pin.
	it('centres the pin on its own point', () => {
		render(<PlantPin plant={figPlant} ordinal={1} hovered={false} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		const className = pinFor(figPlant.id).getAttribute('class') ?? '';
		expect(className).toContain('-translate-x-1/2');
		expect(className).toContain('-translate-y-1/2');
	});

	// An unsited Plant has nowhere to go, and a pin at 0,0 or at the centre
	// would be a confident lie about where it is.
	it('renders nothing for a Plant with no position', () => {
		const { container } = render(<PlantPin plant={unplacedPlantedPlant} ordinal={1} hovered={false} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		expect(container.firstChild).toBeNull();
		expect(screen.queryByRole('button', { hidden: true })).toBeNull();
	});

	it('renders nothing for a planned Plant the yard has not sited yet', () => {
		const { container } = render(<PlantPin plant={plannedPlant} ordinal={1} hovered={false} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		expect(container.firstChild).toBeNull();
	});

	// The pin is aria-hidden, so its title (not an accessible name) is what a
	// The pin used to carry a title attribute, which was the sighted-mouse
	// affordance and, incidentally, what the tests found it by. A real tooltip
	// replaced it and can say more than one line, so this asserts the content a
	// reader actually gets rather than an attribute nobody sees.
	it('names the plant and its site on hover', async () => {
		render(<PlantPin plant={figPlant} ordinal={1} hovered={false} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		fireEvent.pointerEnter(pinFor(figPlant.id));
		fireEvent.focus(pinFor(figPlant.id));

		expect((await screen.findByRole('tooltip')).textContent).toContain(figPlant.name);
	});

	// The yard gets read on a phone in daylight, so colour was never going to
	// carry this on its own. The pin is a numbered callout now rather than a
	// glyph, so the distinction moved from two icon shapes to fill: a solid
	// callout for what is in the ground, an open one for what is not. The
	// requirement is the same, and the number is what identifies which Plant.
	// A paper chip either way, so the numeral reads on any photograph; the
	// border's line style carries planted against planned.
	it('draws a solid border for planted and a dashed one for planned', () => {
		const { container: plantedContainer } = render(<PlantPin plant={figPlant} ordinal={1} hovered={false} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);
		const { container: plannedContainer } = render(<PlantPin plant={plannedAndSited} ordinal={2} hovered={false} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		const planted = plantedContainer.querySelector('button')?.getAttribute('class') ?? '';
		const planned = plannedContainer.querySelector('button')?.getAttribute('class') ?? '';

		expect(planted).toContain('border-solid');
		expect(planned).toContain('border-dashed');
		expect(planted).toContain('bg-plate-paper');
		expect(planned).toContain('bg-plate-paper');
	});

	it('prints a callout on this week\'s ticket in reverse', () => {
		const { container } = render(<PlantPin plant={figPlant} ordinal={1} hovered={false} onHoverChange={() => {}} onSelect={vi.fn()} onTicket />, withTooltip);

		const drawn = container.querySelector('button')?.getAttribute('class') ?? '';
		expect(drawn).toContain('bg-plate-ink');
		expect(drawn).toContain('text-plate-paper');
	});

	// The number is the whole point of the callout: it is what keys the pin to
	// its row in the parts list, so a reader can carry one to the other.
	it('shows the plant\'s line number', () => {
		const { container } = render(<PlantPin plant={figPlant} ordinal={7} hovered={false} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		expect(container.querySelector('button')?.textContent).toBe('7');
	});

	// The callout is hidden from assistive technology entirely, because the parts
	// list below is the equivalent path to every Plant and a pin announced here
	// would put each one in the tab order twice.
	it('marks the callout decorative', () => {
		const { container } = render(<PlantPin plant={figPlant} ordinal={1} hovered={false} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		const pin = container.querySelector('button');
		expect(pin?.getAttribute('aria-hidden')).toBe('true');
		expect(pin?.getAttribute('tabindex')).toBe('-1');
	});
});
