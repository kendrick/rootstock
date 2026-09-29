import type { ReactElement } from 'react';
import type { BandHeading } from './bands';
import { FOCUS_RING } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { bandAnchor } from './bands';

/**
 * A jump to each band the page drew, in the /about contents strip's grammar.
 * It sits in the page body rather than the Shell's margin, because the margin
 * is the same on every route and this belongs to one page.
 *
 * Sticky from sm, where the links fit one row. On a phone they can wrap to two,
 * and a bar that tall would sit over the Rule being read.
 */
export function BandIndex({ bands }: { bands: readonly BandHeading[] }): ReactElement {
	return (
		<nav aria-label="On this page" className="border-y-2 border-rule bg-background sm:sticky sm:top-0 sm:z-10">
			<ul className="flex flex-wrap gap-x-6">
				{bands.map(({ band, label }) => (
					<li key={band}>
						<a
							href={`#${bandAnchor(band)}`}
							className={cn('inline-flex min-h-11 items-center font-display text-label font-extrabold tracking-widest text-foreground uppercase underline underline-offset-4', FOCUS_RING)}
						>
							{label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}
