'use client';

import type { ReactElement } from 'react';
import type { Plant, Position } from '@/yard/plant';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { KIND_TEXT } from './kind-text';

/**
 * One numbered callout on the plate, keyed to a row in the parts list beneath
 * it.
 *
 * A ring of identical dots on a photograph says a Plant is there and nothing
 * about which one. The number answers that without a legend, and it is the same
 * number the row carries, so a reader can carry one to the other.
 *
 * The tooltip is pointer-only, and that is the design rather than an oversight.
 * The callout is `aria-hidden` and out of the tab order because the parts list
 * is the equivalent path to every Plant, and an integration test pins that each
 * Plant reaches the tab order once rather than twice. A tooltip reachable by
 * keyboard would put it back a second time, and everything it says is already in
 * the row the number points at.
 */
export function PlantPin({ plant, position: positionOverride, ordinal, hovered, onHoverChange, onSelect }: {
	plant: Plant;
	/**
	 * Where to draw the pin, if it differs from `plant.position`. `pin-layout.ts`
	 * uses this to spread a crowded cluster apart for rendering without touching
	 * the Plant record, so onSelect still hands its caller the Plant exactly as
	 * the inventory carries it.
	 */
	position?: Position;
	/** The Plant's line number in the parts list, which is what keys this callout to it. */
	ordinal: number;
	/** True while this Plant is under the pointer here or on its row below. */
	hovered: boolean;
	onHoverChange: (plantId: string | null) => void;
	onSelect: (plant: Plant, trigger: HTMLElement) => void;
}): ReactElement | null {
	const position = positionOverride ?? plant.position;

	if (position === null) {
		return null;
	}

	const planned = plant.status === 'planned';

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={event => onSelect(plant, event.currentTarget)}
					onPointerEnter={() => onHoverChange(plant.id)}
					onPointerLeave={() => onHoverChange(null)}
					// `plant-list.tsx` reaches every Plant, sited or not, and a pin tabbed
					// to on its own carries no sense of where on the photo it sits anyway.
					// Without this, a keyboard or screen-reader user met the same nine
					// Plants twice, as two independent button sets with near-identical
					// labels. Pointer and touch interaction are unaffected by either
					// attribute, so the pin still opens the sheet on click exactly as
					// before.
					tabIndex={-1}
					aria-hidden="true"
					// The callout names the record it points at. It carries no accessible
					// name by design, so this is the only stable way anything outside the
					// photograph can say which Plant a given pin is: the linked highlight
					// reads it, and so do the tests that used to find a pin by its title.
					data-plant={plant.id}
					// Percentages of the wrapper, never pixels derived from
					// photo.width/height. Issue #29 swaps public/yard.jpg for an edited
					// image at a different resolution, and a fraction is the only offset
					// that survives that swap without every pin having to be re-sited.
					style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
					className={cn(
						'absolute grid size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center',
						'border-2 font-display text-callout leading-none font-extrabold tabular-nums',
						'transition-transform',
						// Fill for what is in the ground, an outline for what is not. Shape
						// rather than colour, because this is read on a phone in daylight
						// over a photograph whose own colours cannot be relied on.
						planned
							? 'border-ground bg-transparent text-ground'
							: 'border-ground bg-ground text-foreground',
						// The hovered callout grows rather than changing colour. It sits on
						// a photograph, so any colour it took would compete with whatever
						// pixel happens to be beneath it; scale reads on every ground.
						hovered && 'scale-150',
					)}
				>
					{ordinal}
				</button>
			</TooltipTrigger>

			<TooltipContent side="top">
				<p className="font-display text-body font-extrabold tracking-wide uppercase">{plant.name}</p>
				<p className="font-mono text-evidence text-muted">
					{plant.site === null ? KIND_TEXT[plant.kind] : `${KIND_TEXT[plant.kind]} · ${plant.site}`}
				</p>
				{planned && (
					<p className="mt-1 font-display font-semibold text-label tracking-widest text-muted uppercase">Planned</p>
				)}
			</TooltipContent>
		</Tooltip>
	);
}
