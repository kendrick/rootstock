'use client';

import type { ReactElement } from 'react';
import type { Plant, Yard } from '@/yard/plant';
import Image from 'next/image';
import { useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import { declutteredPositions } from './pin-layout';
import { PlantPin } from './plant-pin';

export function YardPhoto({ yard, plants, ordinals, hovered, onHoverChange, onSelect }: {
	yard: Yard;
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

	return (
		<div
			// The box takes its shape from the photo's own dimensions, so a pin's
			// percentage offset lands on the same blade of grass on a phone and on
			// a desktop, and the browser reserves the space before the image loads.
			style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
			className="relative w-full overflow-hidden border-2 border-rule"
		>
			<Image
				// next/image prefixes basePath onto a static import automatically but
				// never onto a plain string src (bundled docs, basePath.md, Images
				// section), and the seed stores this one as a plain string. Without
				// withBasePath, this resolves against the domain root, where a
				// project page has nothing at all.
				src={withBasePath(photo.path)}
				alt={`The yard in ${yard.region.name}, seen from above.`}
				fill
				// 736px is layout.tsx's max-w-3xl less its px-4 gutters: past that
				// breakpoint the column stops growing, so telling the browser
				// otherwise would have it pick a wider candidate than it can use.
				sizes="(min-width: 768px) 736px, 100vw"
				className="object-cover"
				onError={() => setFailed(true)}
			/>
			{/*
				Every Plant goes to a pin and the pin decides, rather than filtering
				here. One place that knows what an unsited Plant means beats two that
				have to agree.

				The position handed to each pin comes from declutteredPositions, not
				necessarily plant.position: three of six pins in the seed's own layout
				failed their own centre hit-test at 390px (the critique's measurement),
				because the owner sited four plants within a 22px span. The nudge is
				rendering-only, so onSelect still hands the sheet the Plant exactly as
				the inventory carries it, position and all.
			*/}
			{plants.map(plant => (
				<PlantPin
					key={plant.id}
					plant={plant}
					position={positions.get(plant.id)}
					ordinal={ordinals.get(plant.id) ?? 0}
					hovered={hovered === plant.id}
					onHoverChange={onHoverChange}
					onSelect={onSelect}
				/>
			))}
		</div>
	);
}
