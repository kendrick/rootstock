import type { ReactElement } from 'react';
import { seedYard } from '@/seed';
import { WORDMARK } from './name';

/**
 * The ticket's own number, derived rather than decorative.
 *
 * A work-order ticket is identified by a number, so this sheet carries one: the
 * year and the day of the year the reader is looking at it. Nothing downstream
 * depends on it, and it is deliberately not the Artifact's generation date,
 * which `StalenessBanner` already reports and which would put two dates on one
 * sheet meaning different things.
 */
function ticketNumber(): string {
	const now = new Date();
	const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 0);
	const day = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - startOfYear) / 86_400_000);

	return `No. ${now.getUTCFullYear()}-${String(day).padStart(3, '0')}`;
}

/**
 * The ticket head: a bordered block of cells running the sheet's full width.
 *
 * It spans both columns rather than sitting in the margin, because the head is
 * what identifies the whole sheet and a form's head is never a sidebar. Giving
 * it the width is also what lets the wordmark carry real weight without
 * enlarging anything a reader has to read.
 */
export function Header(): ReactElement {
	return (
		<header className="grid border-b-2 border-rule sm:grid-cols-[minmax(0,1fr)_auto]">
			<div className="flex items-center px-5 py-4 sm:border-r-2 sm:border-rule">
				{/* print:text-black because the print block flattens the palette to ink,
				    and this keeps the head honest if that override is ever scoped
				    tighter. */}
				<span className="font-display text-wordmark leading-none font-extrabold tracking-tight text-foreground print:text-black">
					{WORDMARK}
				</span>
			</div>

			{/* Plain divs rather than a definition list: both values say what they are
			    (a number prefixed "No.", a region with its zone), so the sr-only terms a
			    dl would need were reading a label to a screen reader that no one else
			    gets and that the value already carries. */}
			<div className="grid content-center divide-y-2 divide-rule border-t-2 border-rule sm:border-t-0">
				<span className="px-5 py-2 font-mono text-body tracking-widest text-foreground">
					{ticketNumber()}
				</span>
				<span className="px-5 py-2 font-display text-label font-bold tracking-widest text-muted uppercase">
					{`${seedYard.region.name} — Zone ${seedYard.region.hardinessZone}`}
				</span>
			</div>
		</header>
	);
}
