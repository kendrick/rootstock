import type { Plant, Position } from '@/yard/plant';

/**
 * The photo's width at the narrowest supported viewport, 390px, less what the
 * sheet frame takes on a phone: its 8px padding each side (`p-2`), its 2px
 * border each side, and the field's 12px gutter each side (`px-3`). This is
 * the smallest the photo ever renders at, and the box only grows from here.
 * Two fractions separated by MIN_CENTER_DISTANCE_PX at this width stay at
 * least that far apart everywhere wider, so clearing this one size is enough.
 * `pin-layout.spec.ts` pins the arithmetic, and the e2e yard spec measures
 * the rendered box, so a gutter change fails a test by name.
 */
export const MOBILE_BOX_WIDTH_PX = 390 - (2 * 8) - (2 * 2) - (2 * 12);

/** A pin's rendered size (`size-6`). */
const PIN_SIZE_PX = 24;

/**
 * Pins render at 24px (a size-4 icon inside p-1 padding). Two centres closer
 * together than their own diameter put each pin's centre inside its
 * neighbour's hit region, which is what let three of six pins fail their own
 * centre hit-test in the critique. A few px of headroom over the bare
 * diameter absorbs rounding in the relaxation pass below.
 */
export const MIN_CENTER_DISTANCE_PX = 28;

const RELAXATION_PASSES = 30;

interface Point {
	id: string;
	x: number;
	y: number;
}

/**
 * Nudges sited Plants' rendered positions apart when the seed's real-world
 * fractions place two pins closer than they can be told apart on a phone.
 * `Plant.position` itself never changes here: this returns a parallel map
 * the photo renders from, so the fraction a future photo swap re-sites from
 * stays the owner's own measurement rather than this layout's guess.
 *
 * Pairwise relaxation rather than a fixed grid: the seed sites six pins and
 * only four of them ever cluster, so most pins should end up exactly where
 * the owner put them, moved only enough to stop failing their own hit-test.
 */
export function declutteredPositions(plants: Plant[], boxAspect: number): Map<string, Position> {
	const boxWidth = MOBILE_BOX_WIDTH_PX;
	const boxHeight = boxWidth * boxAspect;

	const points: Point[] = plants
		.filter((plant): plant is Plant & { position: Position } => plant.position !== null)
		.map(plant => ({
			id: plant.id,
			x: plant.position.x * boxWidth,
			y: plant.position.y * boxHeight,
		}));

	// Held half a pin in from every edge, inside each pass. The photo clips its
	// overflow, so a pin clamped to 0 shows only part of itself. Clamping once
	// after the last pass would undo the spacing, pulling two top-edge pins
	// back within 28px of each other, close enough for one pin's hit area to
	// cover the other's centre.
	const half = PIN_SIZE_PX / 2;

	for (let pass = 0; pass < RELAXATION_PASSES; pass++) {
		for (let i = 0; i < points.length; i++) {
			for (let j = i + 1; j < points.length; j++) {
				separate(points[i]!, points[j]!);
			}
		}
		for (const point of points) {
			point.x = clampBetween(point.x, half, boxWidth - half);
			point.y = clampBetween(point.y, half, boxHeight - half);
		}
	}

	return new Map(points.map(point => [
		point.id,
		{ x: point.x / boxWidth, y: point.y / boxHeight },
	]));
}

function separate(a: Point, b: Point): void {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const distance = Math.hypot(dx, dy);

	if (distance >= MIN_CENTER_DISTANCE_PX) {
		return;
	}

	// Two pins sharing the exact same point have no direction to push apart
	// along, so a fixed nudge along the x axis breaks the tie deterministically.
	const [ux, uy] = distance === 0 ? [1, 0] : [dx / distance, dy / distance];
	const overlap = (MIN_CENTER_DISTANCE_PX - distance) / 2;

	a.x -= ux * overlap;
	a.y -= uy * overlap;
	b.x += ux * overlap;
	b.y += uy * overlap;
}

function clampBetween(value: number, low: number, high: number): number {
	return Math.min(high, Math.max(low, value));
}
