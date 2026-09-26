import type { Plant, Position, Yard } from '@/yard/plant';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BASE_PATH } from '@/lib/base-path';
import { figPlant, isolatedPlant, plantFixtures, yardFixture } from './fixtures';
import { YardPhoto } from './yard-photo';

function positionOf(plant: Plant): Position {
	if (plant.position === null) {
		throw new Error(`fixture '${plant.id}' carries no position: this test has nothing to assert against.`);
	}
	return plant.position;
}

function photoOf(yard: Yard): NonNullable<Yard['photo']> {
	if (yard.photo === null) {
		throw new Error(`fixture yard '${yard.id}' carries no photo: this test has nothing to render.`);
	}
	return yard.photo;
}

/**
 * next/image only renders the src it was given directly when `unoptimized`
 * is threaded through by the Next runtime. jsdom renders this component
 * outside that runtime, so it falls back to its own loader and wraps the src
 * in `/_next/image?url=...`. Reading the `url` param back out is what lets
 * this test hold the same component to an exact match in both environments,
 * rather than settling for a substring check that a dropped basePath would
 * also satisfy.
 */
function resolvedImageSrc(src: string): string {
	const proxied = new URL(src, 'http://localhost').searchParams.get('url');
	return proxied === null ? src : decodeURIComponent(proxied);
}

const sitedPlants = plantFixtures.filter(plant => plant.position !== null);
const unsitedPlants = plantFixtures.filter(plant => plant.position === null);

/**
 * The numbering the component would receive from `Yard`: the parts list's own
 * order. Declared here so a call site reads as one Plant rather than as a Map
 * literal, and so a change to how the numbering is derived lands in one place.
 */
function ordinalsFor(plants: { id: string }[]): ReadonlyMap<string, number> {
	return new Map(plants.map((plant, index) => [plant.id, index + 1]));
}

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

/**
 * The callouts carry tooltips, and Radix requires a provider above them. `Yard`
 * supplies one on the real surface; this stands in for it here.
 */
const withTooltip = { wrapper: TooltipProvider } as const;

describe('yardPhoto', () => {
	// A raw <img> would skip basePath and serve /yard.jpg from the domain root,
	// where a project page has nothing. ESLint rejects the element outright.
	//
	// This asserts the exact resolved path rather than a substring, on purpose:
	// the seed's own bare path, '/yard.jpg', is a substring of the correct
	// '/rootstock/yard.jpg' too, so a substring check here would pass on the
	// broken output exactly the way the one it replaces did.
	it('renders the photo from yard.photo.path, prefixed with the deployed base path', () => {
		render(<YardPhoto yard={yardFixture} plants={plantFixtures} ordinals={ordinalsFor(plantFixtures)} hovered={null} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		const photo = screen.getByRole('img');
		expect(resolvedImageSrc(photo.getAttribute('src') ?? ''))
			.toBe(`${BASE_PATH}${photoOf(yardFixture).path}`);
	});

	it('describes the yard in the alt text', () => {
		render(<YardPhoto yard={yardFixture} plants={plantFixtures} ordinals={ordinalsFor(plantFixtures)} hovered={null} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		expect(screen.getByRole('img').getAttribute('alt')).toContain(yardFixture.region.name);
	});

	// Pins are placed as a fraction of this box, so a box shaped differently
	// from the image puts every one of them off the plant it names. This reads
	// the style attribute rather than element.style.aspectRatio, because jsdom's
	// CSS parser drops properties it does not implement.
	it('shapes the wrapper by the photo\'s own aspect ratio', () => {
		const { container } = render(<YardPhoto yard={yardFixture} plants={plantFixtures} ordinals={ordinalsFor(plantFixtures)} hovered={null} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);
		const photo = photoOf(yardFixture);

		// The plate adds callout bands, so the photo's own ratio is on the box
		// that holds the image: the plate's height times that box's share of it.
		const plate = container.firstElementChild as HTMLElement;
		const box = plate.firstElementChild as HTMLElement;
		const [plateWidth, plateHeight] = plate.style.aspectRatio.split('/').map(Number);
		const share = Number.parseFloat(box.style.height) / 100;
		expect(((plateHeight ?? 0) * share) / (plateWidth ?? 1)).toBeCloseTo(photo.height / photo.width, 6);
	});

	// yardSchema makes the photo nullable, so this case is reachable, and a
	// frame of pins hanging over nothing is worse than silence.
	it('renders nothing when the yard has no photo', () => {
		const photoless: Yard = { ...yardFixture, photo: null };

		const { container } = render(<YardPhoto yard={photoless} plants={plantFixtures} ordinals={ordinalsFor(plantFixtures)} hovered={null} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		expect(container.firstChild).toBeNull();
	});

	// The fixtures deliberately include a planted plant with no position and
	// three planned ones. Counting against the sited subset catches a stray pin
	// parked at the origin.
	it('renders one pin per sited Plant and none for the rest', () => {
		render(<YardPhoto yard={yardFixture} plants={plantFixtures} ordinals={ordinalsFor(plantFixtures)} hovered={null} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		expect(screen.getAllByRole('button', { hidden: true })).toHaveLength(sitedPlants.length);
		// A Plant with no stored position has no Pin and is reached through the
		// list instead (CONTEXT.md), so none of them draws a callout here.
		for (const plant of unsitedPlants) {
			expect(document.querySelector(`[data-plant="${plant.id}"]`)).toBeNull();
		}
	});

	// isolatedPlant is placed clear of every other Pin by construction, so the
	// declutter pass (which only nudges a pin close enough to another to fail its
	// own centre hit-test) leaves it exactly where the fixture put it. It used to
	// be a seed Plant that happened to sit alone, until the owner re-sited the
	// yard and it no longer did.
	it('places an isolated pin by its own fraction of the box, not by a pixel offset', () => {
		const position = positionOf(isolatedPlant);
		render(<YardPhoto yard={yardFixture} plants={plantFixtures} ordinals={ordinalsFor(plantFixtures)} hovered={null} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		// Read back through the photo box's own placement in the plate, so the
		// check is where the pin lands on the photograph.
		const pin = pinFor(isolatedPlant.id);
		const box = pin.closest('[style*="aspect-ratio"]')?.firstElementChild as HTMLElement;
		const onPhoto = (Number.parseFloat(pin.style.top) - Number.parseFloat(box.style.top)) / Number.parseFloat(box.style.height);
		expect(pin.style.left).toBe(`${position.x * 100}%`);
		expect(onPhoto).toBeCloseTo(position.y, 6);
	});

	// The critique measured four seed Plants (esperanza-1 and the three
	// hibiscus) clustered within a 22px span, with three of six pins failing
	// their own centre hit-test at 390px. This asserts against the real seed
	// data rather than a synthetic fixture, since the crowding is a property of
	// where the owner actually sited these plants.
	it('spreads a crowded cluster of pins apart, rather than rendering their raw fractions', () => {
		render(<YardPhoto yard={yardFixture} plants={plantFixtures} ordinals={ordinalsFor(plantFixtures)} hovered={null} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

		const esperanza = plantFixtures.find(plant => plant.id === 'esperanza-1');
		if (esperanza?.position == null) {
			throw new Error('seed plant \'esperanza-1\' carries no position: this test has nothing to compare against.');
		}

		const pin = pinFor(esperanza.id);
		expect(pin.style.left).not.toBe(`${esperanza.position.x * 100}%`);
	});

	// The plant sheet reads the whole Plant, so the pin has to pass the record
	// up rather than its id.
	it('hands the selected Plant to onSelect', () => {
		const onSelect = vi.fn();
		render(<YardPhoto yard={yardFixture} plants={plantFixtures} ordinals={ordinalsFor(plantFixtures)} hovered={null} onHoverChange={() => {}} onSelect={onSelect} />, withTooltip);

		pinFor(figPlant.id).click();

		expect(onSelect).toHaveBeenCalledWith(figPlant, expect.any(HTMLElement));
	});

	// The 404 that motivated this fix raised no console error and left the pins
	// sitting over an empty box: nothing about it looked broken. This is the
	// case where the photo actually fails to load, which the fix above cannot
	// rule out on its own since a correct URL can still 404 or time out.
	describe('when the photo fails to load', () => {
		it('shows a fallback in place of the broken image', () => {
			render(<YardPhoto yard={yardFixture} plants={plantFixtures} ordinals={ordinalsFor(plantFixtures)} hovered={null} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

			fireEvent.error(screen.getByRole('img'));

			expect(screen.queryByRole('img')).toBeNull();
			expect(screen.getByText(/photo could not be loaded/i)).toBeDefined();
		});

		// A pin over a blank frame is what made the 404 invisible in the first
		// place: nothing anchored it to a photo, so nothing looked wrong.
		it('renders no pins over the fallback', () => {
			render(<YardPhoto yard={yardFixture} plants={plantFixtures} ordinals={ordinalsFor(plantFixtures)} hovered={null} onHoverChange={() => {}} onSelect={vi.fn()} />, withTooltip);

			fireEvent.error(screen.getByRole('img'));

			expect(screen.queryAllByRole('button', { hidden: true })).toHaveLength(0);
		});
	});
});
