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

/**
 * How deep the callout bands above and below the photo run, as a fraction of
 * the photo's height: about 29px at the phone reference width, enough for a
 * 24px callout. A fraction rather than pixels, so the plate keeps one aspect
 * ratio and every position stays a percentage.
 */
export const BAND_FRACTION = 0.14;

/**
 * Where a callout draws, as fractions of the photo. `y` below 0 or above 1 is
 * the band above or below it. `anchor` is the Plant's true spot when the
 * callout had to leave it, for the leader line to run back to.
 */
export interface Placement extends Position {
	anchor: Position | null;
}

interface Point {
	id: string;
	/** The owner's fraction, returned as the anchor exactly as given. */
	home: Position;
	/** The owner's own spot, in px at the reference width. */
	trueX: number;
	trueY: number;
	x: number;
	y: number;
	band: 'top' | 'bottom' | null;
}

/**
 * Where each sited Plant's callout draws. `Plant.position` never changes here:
 * this is a rendering answer, so the fraction a future photo swap re-sites
 * from stays the owner's own measurement.
 *
 * A callout stays on its Plant unless another sits within
 * MIN_CENTER_DISTANCE_PX of it. A crowded callout moves out of the photo into
 * a band on the side its Plant is nearer, spaced along the band, with a
 * leader back to the true spot, the way a parts plate handles a crowd. Nudging
 * crowded pins apart inside the photo would put the patio's callouts on the
 * roof, naming a spot that isn't the Plant's.
 */
export function declutteredPositions(plants: Plant[], boxAspect: number): Map<string, Placement> {
	const boxWidth = MOBILE_BOX_WIDTH_PX;
	const boxHeight = boxWidth * boxAspect;
	const half = PIN_SIZE_PX / 2;
	const bandCentre = { top: -(BAND_FRACTION / 2) * boxHeight, bottom: (1 + BAND_FRACTION / 2) * boxHeight };

	const points: Point[] = plants
		.filter((plant): plant is Plant & { position: Position } => plant.position !== null)
		.map((plant) => {
			const trueX = plant.position.x * boxWidth;
			const trueY = plant.position.y * boxHeight;
			// Held half a pin in from every edge. The photo clips nothing now,
			// but a callout hanging off its frame reads as off the plate.
			return {
				id: plant.id,
				home: plant.position,
				trueX,
				trueY,
				x: clampBetween(trueX, half, boxWidth - half),
				y: clampBetween(trueY, half, boxHeight - half),
				band: null,
			};
		});

	// Moving a callout into a band can crowd one left near that edge, so this
	// repeats until nothing is crowded. Each pass moves at least one callout
	// out for good, so it ends.
	for (;;) {
		const crowded = points.filter(point => point.band === null && points.some(other => other !== point && tooClose(point, other)));
		if (crowded.length === 0) {
			break;
		}
		for (const point of crowded) {
			point.band = point.trueY < boxHeight / 2 ? 'top' : 'bottom';
		}
		for (const band of ['top', 'bottom'] as const) {
			spread(points.filter(point => point.band === band), boxWidth, half);
			for (const point of points) {
				if (point.band === band) {
					point.y = bandCentre[band];
				}
			}
		}
		if (points.every(point => point.band !== null)) {
			break;
		}
	}

	return new Map(points.map(point => [
		point.id,
		{
			x: point.x / boxWidth,
			y: point.y / boxHeight,
			anchor: point.band === null ? null : point.home,
		},
	]));
}

function tooClose(a: Point, b: Point): boolean {
	return Math.hypot(a.x - b.x, a.y - b.y) < MIN_CENTER_DISTANCE_PX;
}

/**
 * Callouts in one band, in the order their Plants run across the photo, each
 * at least MIN_CENTER_DISTANCE_PX from the last and all inside the frame's
 * width. Each starts over its own Plant, so a leader runs as near to straight
 * as the crowd allows.
 */
function spread(band: Point[], width: number, half: number): void {
	band.sort((a, b) => a.trueX - b.trueX);
	band.forEach((point, index) => {
		const previous = band[index - 1];
		point.x = Math.max(clampBetween(point.trueX, half, width - half), previous === undefined ? half : previous.x + MIN_CENTER_DISTANCE_PX);
	});
	for (let index = band.length - 1; index >= 0; index--) {
		const next = band[index + 1];
		band[index]!.x = Math.min(band[index]!.x, next === undefined ? width - half : next.x - MIN_CENTER_DISTANCE_PX);
	}
}

function clampBetween(value: number, low: number, high: number): number {
	return Math.min(high, Math.max(low, value));
}
