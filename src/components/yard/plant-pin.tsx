'use client';

import type { ReactElement } from 'react';
import type { Plant } from '@/yard/plant';
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

export function PlantPin({ plant, onSelect }: {
	plant: Plant;
	onSelect: (plant: Plant) => void;
}): ReactElement | null {
	const { position } = plant;

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
			onClick={() => onSelect(plant)}
			// Percentages of the wrapper, never pixels derived from
			// photo.width/height. Issue #29 swaps public/yard.jpg for an edited
			// image at a different resolution, and a fraction is the only offset
			// that survives that swap without every pin having to be re-sited.
			// Without the translate, the button's top-left corner would land on
			// the point and the pin would hang down and to the right of the
			// plant it names.
			style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
			className={cn(
				'absolute -translate-x-1/2 -translate-y-1/2 rounded-full',
				'bg-background/70 p-1 text-foreground shadow-sm ring-1 ring-border',
				'transition-colors hover:bg-background',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
				'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
			)}
		>
			<Icon aria-hidden="true" className={cn('size-4 shrink-0', fill)} />
			{/*
				Hidden rather than drawn: the seed already sites six plants, and six
				names printed across one photo would overlap into mush. The name still
				has to exist somewhere, so it goes in the button's own text, which is
				where a button's accessible name comes from.
			*/}
			<span className="sr-only">{`${plant.name}${suffix}`}</span>
		</button>
	);
}
