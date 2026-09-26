'use client';

import type { ReactElement } from 'react';
import type { YardView } from './plant-list';
import type { Artifact } from '@/artifact/artifact';
import type { Rule } from '@/rules/rule';
import type { Store } from '@/store/store';
import type { Plant, Yard as YardRecord } from '@/yard/plant';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { coverage } from './applicable-rules';
import { PlantList } from './plant-list';
import { PlantSheet } from './plant-sheet';
import { ticketLines } from './week-work';
import { YardPhoto } from './yard-photo';

function isView(value: string | null): value is YardView {
	return value === 'week' || value === 'all';
}

export interface YardProps {
	yard: YardRecord;
	plants: Plant[];
	rules: Rule[];
	artifact: Artifact;
	/** Handed straight to {@link PlantSheet}; omit it for the browser store. */
	store?: Store;
}

/**
 * The photo and the list over one sheet.
 *
 * Both paths call the same `onSelect`, so a pin and a list row open the same
 * sheet for the same Plant. That is the point of the list rather than a
 * convenience. A planned Plant carries no position and so has no pin, and a
 * keyboard or screen reader has no useful way into the photo at all. Two
 * selection paths that could drift apart would leave those readers with a
 * second-class view of the yard.
 *
 * The selection is the Plant itself and not its id. The sheet needs the record,
 * and a lookup by id here would be a second place that has to agree with the
 * list about which Plant a click meant.
 */
export function Yard({ yard, plants, rules, artifact, store }: YardProps): ReactElement {
	// One number per Plant, shared by its callout on the plate and its row in the
	// list below. The list's own order is the numbering, so a reader reads the
	// number off the photograph and finds the same number in the parts list
	// without a legend in between.
	const ordinals = useMemo(
		() => new Map(plants.map((plant, index) => [plant.id, index + 1])),
		[plants],
	);

	// Which Plant is under the pointer, wherever the pointer is. The plate and
	// the parts list are siblings, so neither can own this: a callout and its row
	// carry the same number and have to light together, or the number is the only
	// thing joining them and the reader does the joining.
	const [hovered, setHovered] = useState<string | null>(null);

	const [selected, setSelected] = useState<Plant | null>(null);

	const lines = useMemo(() => ticketLines(artifact.plan.tasks), [artifact]);
	const ruleNames = useMemo(() => new Map(rules.map(rule => [rule.id, rule.name])), [rules]);
	const standings = useMemo(() => new Map(plants.map(plant => [plant.id, coverage(plant, rules, plants)])), [plants, rules]);

	/*
	 * Two readings of one yard: the week's work laid over the plate, or the
	 * whole inventory. The week view is the default whenever the ticket names
	 * any Plant, because "what does the yard need this week" is the question
	 * this product answers. The choice lives in the link's `?view=` and nowhere
	 * else, so a reload or a shared link keeps it and a fresh visit gets the
	 * week back. A choice kept on the device would hide the week for good after
	 * one tap on All plants.
	 */
	const [view, setView] = useState<YardView>(lines.size > 0 ? 'week' : 'all');

	useEffect(() => {
		const fromUrl = new URLSearchParams(window.location.search).get('view');
		if (isView(fromUrl)) {
			// eslint-disable-next-line react/set-state-in-effect -- the URL is only readable in a browser, and the prerender has none
			setView(fromUrl);
		}
	}, []);

	function chooseView(next: YardView): void {
		setView(next);
		const url = new URL(window.location.href);
		url.searchParams.set('view', next);
		window.history.replaceState(null, '', url);
	}

	const dimmed = useMemo(
		() => view === 'week' ? new Set(plants.filter(plant => !lines.has(plant.id)).map(plant => plant.id)) : new Set<string>(),
		[view, plants, lines],
	);

	// A pin and a list row can both open the sheet for the same Plant, so
	// Radix's own trigger-tracking (built for a single Trigger component) has
	// nothing to restore to. This is the one whichever of the two actually
	// fired, kept outside state so recording it never causes a render.
	const triggerRef = useRef<HTMLElement | null>(null);

	function handleSelect(plant: Plant, trigger: HTMLElement): void {
		triggerRef.current = trigger;
		setSelected(plant);
	}

	// Radix needs one provider above every tooltip on the surface. It sits here
	// rather than in the shell because the plate is the only thing that uses one.
	return (
		<TooltipProvider delayDuration={120}>
			<div className="space-y-6">
				<p className="max-w-prose text-body text-muted">
					The numbers on the photo match the list below. Filled callouts are planted, outlined ones are planned. Open one for its site, the Rules that reach it, and the work recorded against it.
				</p>

				{/* Two ruled cells, not a pill: a pressed cell prints in reverse. */}
				<div role="group" aria-label="Show" className="inline-flex border-2 border-rule">
					{(['week', 'all'] as const).map(option => (
						<button
							key={option}
							type="button"
							aria-pressed={view === option}
							onClick={() => chooseView(option)}
							className={cn(
								'inline-flex min-h-11 items-center px-3 font-display text-label font-extrabold tracking-widest uppercase',
								'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
								option === 'all' && 'border-l-2 border-rule',
								view === option ? 'bg-foreground text-background' : 'text-muted hover:text-foreground',
							)}
						>
							{option === 'week' ? 'This week' : 'All plants'}
						</button>
					))}
				</div>

				<YardPhoto
					yard={yard}
					plants={plants}
					ordinals={ordinals}
					hovered={hovered}
					dimmed={dimmed}
					onHoverChange={setHovered}
					onSelect={handleSelect}
				/>
				<PlantList
					plants={plants}
					ordinals={ordinals}
					hovered={hovered}
					onHoverChange={setHovered}
					onSelect={handleSelect}
					lines={lines}
					ruleNames={ruleNames}
					standings={standings}
					view={view}
				/>
				<PlantSheet
					plant={selected}
					rules={rules}
					plants={plants}
					artifact={artifact}
					store={store}
					// Nothing here opens the sheet. A Plant is what opens it, and Radix
					// only reports `false` for the close control, the overlay, and Escape,
					// so clearing the selection is the whole job.
					onOpenChange={(open) => {
						if (!open) {
							setSelected(null);
						}
					}}
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						triggerRef.current?.focus();
					}}
				/>
			</div>
		</TooltipProvider>
	);
}
