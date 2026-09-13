import type { ReactElement } from 'react';
import type { Plant } from '@/yard/plant';
import { Badge } from '@/components/ui/badge';

/**
 * Two containers on the same patio (see the hibiscus pair in the seed) look
 * identical until this word tells them apart, so it is never left implicit in
 * styling alone.
 *
 * `plant-sheet.tsx` keeps an identical copy, which is a duplicate nobody is
 * happy about. Exporting it from here trips `react-refresh/only-export-components`,
 * a module holding components may not also export a constant, and #13 owns no
 * shared non-component module to move it to. The risk the copy carries is a row
 * and the sheet it opens naming one Plant two different things, so the two lists
 * are edited together until there is somewhere to put this.
 */
const KIND_TEXT: Record<Plant['kind'], string> = {
	plant: 'Plant',
	container: 'Container',
	bed: 'Bed',
	lawn: 'Lawn',
};

/**
 * One row's worth of identifying detail. Rendered as text rather than an
 * aria-label so a sighted reader on a phone in the yard sees the same thing a
 * screen reader announces, matching the house rule from `SourceBadge`.
 */
function PlantRow({ plant, onSelect }: { plant: Plant; onSelect: (plant: Plant) => void }): ReactElement {
	return (
		<li className="border-b border-border last:border-b-0">
			<button
				type="button"
				onClick={() => onSelect(plant)}
				className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
			>
				<span className="flex flex-wrap items-center gap-2">
					<span className="font-semibold text-foreground">{plant.name}</span>
					{plant.status === 'planned' && (
						<Badge variant="secondary" className="uppercase">Planned</Badge>
					)}
				</span>
				<span className="text-sm text-muted-foreground">
					{plant.site === null ? KIND_TEXT[plant.kind] : `${KIND_TEXT[plant.kind]} · ${plant.site}`}
				</span>
			</button>
		</li>
	);
}

/**
 * The list is the equivalent path to every Plant for anyone not using the
 * photo: assistive technology, a keyboard, and the planned Plants that carry
 * no `position` and so have no pin to click. Rendering every Plant here,
 * position or not, is what keeps that path equivalent rather than partial.
 */
export function PlantList({ plants, onSelect }: {
	plants: Plant[];
	onSelect: (plant: Plant) => void;
}): ReactElement {
	return (
		<ul aria-label="Plants" className="flex flex-col rounded-md border border-border">
			{plants.map(plant => (
				<PlantRow key={plant.id} plant={plant} onSelect={onSelect} />
			))}
		</ul>
	);
}
