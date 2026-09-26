import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SectionProps {
	id: string;
	label: string;
	children: ReactNode;
	/** Sets the label in ink and the top rule heavier, for a section a reader should find before the ones around it. */
	emphasis?: boolean;
}

/**
 * One labelled band of the sheet.
 *
 * A type specimen puts its labels in the margin and its material in the field
 * beside them, and that is the whole reason this component exists: it is where
 * the construction grid stops being a background texture and starts holding the
 * page together. Section headings set above their own prose read as a stack of
 * small grey captions that nothing distinguishes; a label in its own column,
 * under a rule that runs the full measure, gives every section an edge a reader
 * can find without reading it.
 *
 * It also answers what a wide viewport is for. The label column is where the
 * extra width goes, so a desktop reader gets more of the week on screen and a
 * marginal index to move through it by, instead of the same column enlarged.
 *
 * Below the column breakpoint the label sits above its content, which is the
 * ordinary stacked reading a phone wants.
 */
export function Section({ id, label, children, emphasis = false }: SectionProps): ReactElement {
	return (
		<section
			aria-labelledby={id}
			className={cn(
				'grid gap-x-8 gap-y-2 border-t-2 pt-4 md:grid-cols-[10rem_minmax(0,1fr)]',
				emphasis ? 'border-t-4 border-foreground' : 'border-rule',
			)}
		>
			<h2
				id={id}
				className={cn(
					// Hanging in the margin on a wide screen and never wrapping mid-label:
					// the column is sized for the longest of them.
					'font-display text-heading leading-snug font-extrabold tracking-wider uppercase',
					emphasis ? 'text-foreground' : 'text-muted',
				)}
			>
				{label}
			</h2>

			<div className="min-w-0 space-y-3">{children}</div>
		</section>
	);
}
