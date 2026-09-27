'use client';

import type { ReactElement } from 'react';
import type { Plant, Position } from '@/yard/plant';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { calloutFace } from './callout-style';
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
export function PlantPin({ plant, position: positionOverride, ordinal, hovered, onHoverChange, onSelect, onTicket = false }: {
	plant: Plant;
	/**
	 * Where to draw the pin, as a fraction of the plate, when that differs from
	 * `plant.position`. `yard-photo.tsx` passes pin-layout's placement, which
	 * can move a crowded callout into a band outside the photo, without touching
	 * the Plant record, so onSelect still hands its caller the Plant exactly as
	 * the inventory carries it.
	 */
	position?: Position;
	/** The Plant's line number in the parts list, which is what keys this callout to it. */
	ordinal: number;
	/** True while this Plant is under the pointer here or on its row below. */
	hovered: boolean;
	/** Printed in reverse in the week view, because this week's ticket names this Plant. */
	onTicket?: boolean;
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
						'absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer',
						// A 44px hit area around the 24px mark, the target size the rest of
						// the site holds itself to. Round, and invisible: a 44px square
						// reaches 31px from its centre at the corners, past the 28px that
						// pin-layout.ts keeps neighbours apart, so it would cover a
						// diagonal neighbour's centre. A 22px radius never does. Hit-testing
						// honours border-radius, and nothing drawn here is rounded. The inset
						// is 12px because it measures from inside the 2px border.
						'before:absolute before:-inset-3 before:rounded-full before:content-[\'\']',
						'transition-transform',
						calloutFace({ planned, onTicket }),
						// The hovered callout grows rather than changing colour. It sits on
						// a photograph, so any colour it took would compete with whatever
						// pixel happens to be beneath it; scale reads on every ground. The
						// hit area scales back by the same factor and keeps its resting size.
						// Grown with the chip, it would reach past a neighbour's centre 28px
						// away.
						hovered && 'scale-150 before:scale-[calc(2/3)]',
					)}
				>
					{ordinal}
				</button>
			</TooltipTrigger>

			<TooltipContent side="top">
				<p className="font-display text-body font-extrabold tracking-wide uppercase">{plant.name}</p>
				<p className="text-note text-muted">
					{plant.site === null ? KIND_TEXT[plant.kind] : `${KIND_TEXT[plant.kind]} · ${plant.site}`}
				</p>
				{planned && (
					<p className="mt-1 font-display font-semibold text-label tracking-widest text-muted uppercase">Planned</p>
				)}
			</TooltipContent>
		</Tooltip>
	);
}
