'use client';

import type { ReactElement } from 'react';
import type { Plant, Yard } from '@/yard/plant';
import Image from 'next/image';
import { PlantPin } from './plant-pin';

export function YardPhoto({ yard, plants, onSelect }: {
	yard: Yard;
	plants: Plant[];
	onSelect: (plant: Plant) => void;
}): ReactElement | null {
	const { photo } = yard;

	// yardSchema makes the photo nullable and nothing downstream guarantees one,
	// so a yard with no photo renders nothing at all rather than an empty frame
	// with pins floating on it.
	if (photo === null) {
		return null;
	}

	return (
		<div
			// The box takes its shape from the photo's own dimensions, so a pin's
			// percentage offset lands on the same blade of grass on a phone and on
			// a desktop, and the browser reserves the space before the image loads.
			style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
			className="relative w-full overflow-hidden rounded-lg border border-border"
		>
			<Image
				src={photo.path}
				alt={`The yard in ${yard.region.name}, seen from above.`}
				fill
				// 736px is layout.tsx's max-w-3xl less its px-4 gutters: past that
				// breakpoint the column stops growing, so telling the browser
				// otherwise would have it pick a wider candidate than it can use.
				sizes="(min-width: 768px) 736px, 100vw"
				className="object-cover"
			/>
			{/*
				Every Plant goes to a pin and the pin decides, rather than filtering
				here. One place that knows what an unsited Plant means beats two that
				have to agree.
			*/}
			{plants.map(plant => (
				<PlantPin key={plant.id} plant={plant} onSelect={onSelect} />
			))}
		</div>
	);
}
