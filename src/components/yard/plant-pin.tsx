'use client';

import type { ReactElement } from 'react';
import type { Plant, Position } from '@/yard/plant';
import { Circle, CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PinTreatment {
	Icon: typeof Circle;
	fill: string;
	suffix: string;
}

/**
 * A planned Plant is one the yard has not put in the ground yet (CONTEXT.md,
 * Plant). The shell is one monochrome zinc theme, so there is no second colour
 * to say that with, and colour would be lost on a greyscale screen and silent
 * to a screen reader anyway. The glyph carries the distinction instead: a solid
 * disc for what is in the ground, an open dashed one for what is not, plus the
 * word itself in the button's accessible name.
 */
const PIN_TREATMENT: Record<Plant['status'], PinTreatment> = {
	planted: { Icon: Circle, fill: 'fill-current', suffix: '' },
	planned: { Icon: CircleDashed, fill: 'fill-none', suffix: ', planned' },
};

export function PlantPin({ plant, position: positionOverride, onSelect }: {
	plant: Plant;
	/**
	 * Where to draw the pin, if it differs from `plant.position`. `pin-layout.ts`
	 * uses this to spread a crowded cluster apart for rendering without
	 * touching the Plant record, so onSelect still hands its caller the Plant
	 * exactly as the inventory carries it.
	 */
	position?: Position;
	onSelect: (plant: Plant, trigger: HTMLElement) => void;
}): ReactElement | null {
	const position = positionOverride ?? plant.position;

	// No position means there is nowhere on the photo to put this Plant. The
	// list view is where an unsited Plant gets seen, so the photo stays silent
	// rather than guessing at a corner to park it in.
	if (position === null) {
		return null;
	}

	const { Icon, fill, suffix } = PIN_TREATMENT[plant.status];

	return (
		<button
			type="button"
			onClick={event => onSelect(plant, event.currentTarget)}
			// `plant-list.tsx` reaches every Plant, sited or not, and a pin tabbed
			// to on its own carries no sense of where on the photo it sits anyway.
			// Without this, a keyboard or screen-reader user met the same nine
			// Plants twice, as two independent button sets with near-identical
			// labels. Pointer and touch interaction are unaffected by either
			// attribute, so the pin still opens the sheet on click exactly as
			// before.
			tabIndex={-1}
			aria-hidden="true"
			// Percentages of the wrapper, never pixels derived from
			// photo.width/height. Issue #29 swaps public/yard.jpg for an edited
			// image at a different resolution, and a fraction is the only offset
			// that survives that swap without every pin having to be re-sited.
			style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
			// A hover title rather than the accessible name it used to be: aria-hidden
			// takes the button out of the accessible-name computation entirely, so a
			// sighted mouse user still gets to know what they're pointing at.
			title={`${plant.name}${suffix}`}
			className={cn(
				'absolute -translate-x-1/2 -translate-y-1/2 rounded-full',
				'bg-background/70 p-1 text-foreground shadow-sm ring-1 ring-border',
				'transition-colors hover:bg-background',
			)}
		>
			<Icon aria-hidden="true" className={cn('size-4 shrink-0', fill)} />
		</button>
	);
}
