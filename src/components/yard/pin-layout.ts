import type { Plant, Position } from '@/yard/plant';

/**
 * The photo's width at the narrowest phone the Yard is read on, 360px, less what the
 * sheet frame takes on a phone: its 8px padding each side (`p-2`), its 2px
 * border each side, and the field's 12px gutter each side (`px-3`). This is
 * the smallest the photo ever renders at, and the box only grows from here.
 * Two fractions separated by MIN_CENTER_DISTANCE_PX at this width stay at
 * least that far apart everywhere wider, so clearing this one size is enough.
 * `pin-layout.spec.ts` pins the arithmetic, and the e2e yard spec measures
 * the rendered box, so a gutter change fails a test by name.
 */
export const MOBILE_BOX_WIDTH_PX = 360 - (2 * 8) - (2 * 2) - (2 * 12);

/** A pin's rendered size (`size-6`). */
const PIN_SIZE_PX = 24;

/**
 * Pins render at 24px. Two centres closer together than their own diameter
 * put each pin's centre inside its neighbour's hit region, which is what let
 * three of six pins fail their own centre hit-test in the critique. A few px
 * of headroom over the bare diameter absorbs rounding.
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
 * How far apart a band's rows sit, in px at the reference width: a band's
 * depth, or MIN_CENTER_DISTANCE_PX where a wide photo makes the band shallower
 * than that, so a second row never crowds the first.
 */
function rowPitchPx(boxAspect: number): number {
	return Math.max(BAND_FRACTION * MOBILE_BOX_WIDTH_PX * boxAspect, MIN_CENTER_DISTANCE_PX);
}

/**
 * How much plate the callouts need above and below the photo, as fractions of
 * the photo's height: one row's pitch for each row a band uses, and nothing on
 * a side with no callouts. `yard-photo.tsx` reserves exactly this, so a second
 * row gets room only when a crowd needs one.
 */
export function bandDepths(placements: Iterable<Position>, boxAspect: number): { top: number; bottom: number } {
	const pitch = rowPitchPx(boxAspect) / (MOBILE_BOX_WIDTH_PX * boxAspect);
	let top = 0;
	let bottom = 0;
	for (const { y } of placements) {
		// A row's centre sits half a pitch into it, so rounding up counts the
		// rows. The epsilon absorbs float noise on a centre worked out in px.
		if (y < 0) {
			top = Math.max(top, Math.ceil(-y / pitch - 1e-9));
		}
		else if (y > 1) {
			bottom = Math.max(bottom, Math.ceil((y - 1) / pitch - 1e-9));
		}
	}
	return { top: top * pitch, bottom: bottom * pitch };
}

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
 * leader back to the true spot, the way a parts plate handles a crowd. A band
 * with more callouts than one row holds stacks a second row farther out. Nudging
 * crowded pins apart inside the photo would put the patio's callouts on the
 * roof, naming a spot that isn't the Plant's.
 */
export function declutteredPositions(plants: Plant[], boxAspect: number): Map<string, Placement> {
	const boxWidth = MOBILE_BOX_WIDTH_PX;
	const boxHeight = boxWidth * boxAspect;
	const half = PIN_SIZE_PX / 2;
	const pitch = rowPitchPx(boxAspect);
	// Row 0 hugs the photo and each further row sits one pitch farther out.
	const rowCentre = { top: (row: number) => -(row + 0.5) * pitch, bottom: (row: number) => boxHeight + (row + 0.5) * pitch };
	// Centres run from half a pin in at one edge to half a pin in at the other,
	// MIN_CENTER_DISTANCE_PX apart: 11 at the reference width.
	const perRow = Math.floor((boxWidth - 2 * half) / MIN_CENTER_DISTANCE_PX) + 1;

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
			// Past one row's capacity the band stacks. Dealing the crowd across the
			// rows in turn, in the order the Plants run across the photo, keeps each
			// row spread over the width its anchors span, so no row's leaders have
			// to run the plate's width to reach their slots.
			const members = points.filter(point => point.band === band).sort((a, b) => a.trueX - b.trueX);
			const rows = Math.max(1, Math.ceil(members.length / perRow));
			for (let row = 0; row < rows; row++) {
				const inRow = members.filter((_, index) => index % rows === row);
				for (const point of inRow) {
					point.y = rowCentre[band](row);
				}
				spread(inRow, boxWidth, half);
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
 * Callouts in one band row, in the order their Plants run across the photo,
 * each at least MIN_CENTER_DISTANCE_PX from the last and all inside the
 * frame's width. The caller keeps a row within its capacity, which is what
 * lets both hold at once. Each starts over its own Plant, so a leader runs as near to straight
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

	// Anchors at nearly one x can still cross once their slots are set, when the
	// one farther from the band takes the nearer slot. Swapping a crossing pair's
	// slots always shortens the leaders' total length, so this ends; the bound is
	// a guard, not a limit it reaches.
	for (let guard = 0; guard < band.length * band.length; guard++) {
		const pair = crossingPair(band);
		if (pair === null) {
			break;
		}
		const [a, b] = pair;
		[a.x, b.x] = [b.x, a.x];
	}
}

function crossingPair(band: Point[]): [Point, Point] | null {
	for (let i = 0; i < band.length; i++) {
		for (let j = i + 1; j < band.length; j++) {
			if (leadersCross(band[i]!, band[j]!)) {
				return [band[i]!, band[j]!];
			}
		}
	}
	return null;
}

/** Whether two leaders, anchor to callout, cross. Both callouts share the row's y. */
function leadersCross(a: Point, b: Point): boolean {
	const side = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
	const y = a.y;
	return side(a.trueX, a.trueY, a.x, y, b.trueX, b.trueY) * side(a.trueX, a.trueY, a.x, y, b.x, y) < 0
		&& side(b.trueX, b.trueY, b.x, y, a.trueX, a.trueY) * side(b.trueX, b.trueY, b.x, y, a.x, y) < 0;
}

function clampBetween(value: number, low: number, high: number): number {
	return Math.min(high, Math.max(low, value));
}
