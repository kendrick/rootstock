'use client';

import type { ReactElement } from 'react';
import type { Plant, Yard } from '@/yard/plant';
import Image from 'next/image';
import { useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import { PlantPin } from './plant-pin';

export function YardPhoto({ yard, plants, onSelect }: {
	yard: Yard;
	plants: Plant[];
	onSelect: (plant: Plant) => void;
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
				className="flex w-full items-center justify-center rounded-lg border border-border bg-muted"
			>
				<p className="px-4 text-center text-sm text-muted-foreground">
					The yard photo could not be loaded.
				</p>
			</div>
		);
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
			*/}
			{plants.map(plant => (
				<PlantPin key={plant.id} plant={plant} onSelect={onSelect} />
			))}
		</div>
	);
}
