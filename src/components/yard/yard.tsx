'use client';

import type { ReactElement } from 'react';
import type { Artifact } from '@/artifact/artifact';
import type { Rule } from '@/rules/rule';
import type { Store } from '@/store/store';
import type { Plant, Yard as YardRecord } from '@/yard/plant';
import { useState } from 'react';
import { PlantList } from './plant-list';
import { PlantSheet } from './plant-sheet';
import { YardPhoto } from './yard-photo';

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
	const [selected, setSelected] = useState<Plant | null>(null);

	return (
		<div className="space-y-6">
			<YardPhoto yard={yard} plants={plants} onSelect={setSelected} />
			<PlantList plants={plants} onSelect={setSelected} />
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
			/>
		</div>
	);
}
