'use client';

import type { ReactElement } from 'react';
import type { Plant, Yard } from '@/yard/plant';
import Image from 'next/image';
import { useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import { cn } from '@/lib/utils';
import { BAND_FRACTION, declutteredPositions } from './pin-layout';
import { PlantPin } from './plant-pin';

export function YardPhoto({ yard, plants, ordinals, hovered, onHoverChange, onSelect, onTicket = new Set() }: {
	yard: Yard;
	/** Plants the week view prints in reverse, because this week's ticket names them. */
	onTicket?: ReadonlySet<string>;
	plants: Plant[];
	/** Plant id to its line number in the parts list, so a callout and its row carry the same number. */
	ordinals: ReadonlyMap<string, number>;
	/** The Plant under the pointer, here or on its row below. */
	hovered: string | null;
	onHoverChange: (plantId: string | null) => void;
	onSelect: (plant: Plant, trigger: HTMLElement) => void;
}): ReactElement | null {
	const { photo } = yard;

	// A 404 on this image raised no console error and left six pins sitting
	// over an empty box, which is why nothing ever reported it. `onError` is
	// the one signal the browser actually gives for that, so it drives a
	// fallback frame instead of a load nobody can see failed.
	const [failed, setFailed] = useState(false);

	// yardSchema makes the photo nullable and nothing downstream guarantees one,
	// so a yard with no photo renders nothing at all rather than an empty frame
	// with pins floating on it.
	if (photo === null) {
		return null;
	}

	if (failed) {
		return (
			<div
				style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
				className="flex w-full items-center justify-center border-2 border-rule"
			>
				<p className="px-4 text-center text-note text-muted">
					The yard photo could not be loaded.
				</p>
			</div>
		);
	}

	const positions = declutteredPositions(plants, photo.height / photo.width);

	/*
	 * The plate is the photo plus a callout band above or below it where a
	 * crowd needs one. Every position below is a fraction of the plate, so a
	 * leader lands on the same spot at every width. `toPlate` turns the
	 * layout's photo fractions into plate fractions.
	 */
	const placed = [...positions.values()];
	const top = placed.some(position => position.y < 0) ? BAND_FRACTION : 0;
	const bottom = placed.some(position => position.y > 1) ? BAND_FRACTION : 0;
	const span = 1 + top + bottom;
	const toPlate = (x: number, y: number) => ({ x, y: (y + top) / span });
	const leaders = [...positions.entries()].flatMap(([id, position]) => position.anchor === null
		? []
		: [{ id, from: toPlate(position.anchor.x, position.anchor.y), to: toPlate(position.x, position.y) }]);

	return (
		<div
			// The plate takes its shape from the photo's own dimensions plus its
			// bands, so a percentage lands on the same blade of grass on a phone
			// and on a desktop, and the browser reserves the space before the
			// image loads.
			style={{ aspectRatio: `${photo.width} / ${photo.height * span}` }}
			className="relative w-full"
		>
			<div
				style={{ top: `${(top / span) * 100}%`, height: `${(1 / span) * 100}%` }}
				className="absolute inset-x-0 overflow-hidden border-2 border-rule"
			>
				<Image
					// next/image prefixes basePath onto a static import automatically but
					// never onto a plain string src (bundled docs, basePath.md, Images
					// section), and the seed stores this one as a plain string. Without
					// withBasePath, this resolves against the domain root, where a
					// project page has nothing at all.
					src={withBasePath(photo.path)}
					alt={`Aerial photo of the yard in ${yard.region.name}. The numbered callouts match the Plant list.`}
					fill
					// Half the field from lg, where the plate sits beside the list, and
					// the sheet's full width below it.
					sizes="(min-width: 1024px) 475px, 100vw"
					className="object-cover"
					onError={() => setFailed(true)}
				/>
			</div>

			{/*
				Leaders from a moved callout back to its Plant's true spot: an ink
				line on a paper casing, because either colour alone vanishes on half
				the photo. aria-hidden with the callouts, whose rows carry the same
				fact in words.
			*/}
			{leaders.length > 0 && (
				<svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
					{/* The hovered Plant's leader draws heavier and last, so it reads
					    above the others where they converge on the patio. */}
					{[...leaders].sort((a, b) => Number(a.id === hovered) - Number(b.id === hovered)).map(leader => (
						<g key={leader.id} data-leader={leader.id}>
							<line x1={leader.from.x * 100} y1={leader.from.y * 100} x2={leader.to.x * 100} y2={leader.to.y * 100} vectorEffect="non-scaling-stroke" className="stroke-plate-paper" strokeWidth={leader.id === hovered ? 5.5 : 3.5} />
							<line x1={leader.from.x * 100} y1={leader.from.y * 100} x2={leader.to.x * 100} y2={leader.to.y * 100} vectorEffect="non-scaling-stroke" className="stroke-plate-ink" strokeWidth={leader.id === hovered ? 3 : 1.5} />
						</g>
					))}
				</svg>
			)}
			{leaders.map(leader => (
				<span
					key={`spot-${leader.id}`}
					aria-hidden="true"
					data-spot={leader.id}
					style={{ left: `${leader.from.x * 100}%`, top: `${leader.from.y * 100}%` }}
					className={cn(
						'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 border-2 border-plate-paper bg-plate-ink',
						leader.id === hovered ? 'z-10 size-3' : 'size-2',
					)}
				/>
			))}

			{/*
				Every Plant goes to a pin and the pin decides, rather than filtering
				here. One place that knows what an unsited Plant means beats two that
				have to agree. The position is rendering-only, so onSelect still
				hands the sheet the Plant exactly as the inventory carries it.
			*/}
			{plants.map((plant) => {
				const position = positions.get(plant.id);
				return (
					<PlantPin
						key={plant.id}
						plant={plant}
						position={position === undefined ? undefined : toPlate(position.x, position.y)}
						ordinal={ordinals.get(plant.id) ?? 0}
						hovered={hovered === plant.id}
						onTicket={onTicket.has(plant.id)}
						onHoverChange={onHoverChange}
						onSelect={onSelect}
					/>
				);
			})}
		</div>
	);
}
