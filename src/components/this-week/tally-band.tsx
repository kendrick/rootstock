import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

/**
 * How many cells the band draws, whatever the week holds.
 *
 * A band sized to the week would make every week look identical: three Tasks
 * filling a strip and nine Tasks filling the same strip say nothing to each
 * other. At a fixed width the fill itself is the comparison, so a heavy week
 * reads as heavy against the memory of a light one.
 *
 * It is not a capacity or a limit. Nothing caps how much work the Planner may
 * author, and the band overflows into a second row rather than truncating,
 * because a Task the display dropped would be indistinguishable from one nobody
 * thought of.
 */
const BAND_CELLS = 13;

export interface TallyBandProps {
	total: number;
	recorded: number;
}

/**
 * The week's load as a strip of cells: filled for work already recorded,
 * outlined for work still open, faint for the rest of the band.
 *
 * It is the first thing under the nav because it answers the only question a
 * reader has before they have read anything—how much—and answers it without
 * language, which is what makes it survive a glance in full sun.
 *
 * `aria-hidden` on purpose. The band is a second rendering of a number the
 * sentence beneath it already states exactly, and a screen reader counting
 * thirteen divs would be doing work to arrive at "3 tasks, 1 recorded, 2 open".
 * The text is the accessible answer; this is the fast one.
 */
export function TallyBand({ total, recorded }: TallyBandProps): ReactElement {
	const cells = Math.max(BAND_CELLS, total);

	return (
		<div
			aria-hidden="true"
			className="flex w-full border border-rule print:border-black"
		>
			{Array.from({ length: cells }, (_, index) => (
				<span
					key={index}
					className={cn(
						// A square is the unit here: the band is the construction grid
						// promoted to content, so its cells are the grid's own cells rather
						// than a bar chart's segments.
						'aspect-square min-w-0 flex-1 border-r border-rule last:border-r-0 print:border-black',
						index < recorded && 'bg-accent',
						index >= recorded && index < total && 'bg-transparent',
						// Beyond the week's own work the cell stops being a task and
						// becomes the band's own ground, so it loses its dividing rule's
						// weight rather than claiming to be an empty Task.
						index >= total && 'border-r-rule-faint bg-rule-faint/40 print:bg-transparent',
					)}
				/>
			))}
		</div>
	);
}
