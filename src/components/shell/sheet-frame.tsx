'use client';

import type { ReactElement, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from './header';
import { RailApparatus, RailNotLit } from './rail';

/**
 * The sheet every route renders inside, and the one route that gets a different
 * sheet.
 *
 * The owner's routes are a work-order ticket: a bounded sheet with a head, a
 * margin carrying the week's apparatus, and a field carrying the work. The Away
 * Card is the stub torn off that ticket, and it brings its own sheet, so this
 * gets out of its way rather than framing one sheet inside another.
 *
 * The margin is the reason this is a decision rather than a layout preference.
 * It carries the Task and open counts for the whole Plan and the Rules nothing
 * lit, and the Away Card's entire discipline is that a household reader is shown
 * Delegable work and told how much is withheld, in which of two senses, and
 * never what it is (CONTEXT.md, Withheld). A rail reporting the raw total sits
 * directly above a sentence carefully saying less than that. The nav is the same
 * problem in a smaller way: it invites a reader with no standing over the Plan
 * into the routes that hold it.
 *
 * Read from the pathname rather than passed down, because a root layout in the
 * App Router cannot be opted out of by a route beneath it, and threading a flag
 * through every page to reach one of them would put this decision in five files.
 */
export function SheetFrame({ children }: { children: ReactNode }): ReactElement {
	const pathname = usePathname();
	const isAwayCard = pathname.startsWith('/away/');

	if (isAwayCard) {
		// Still a main landmark. The card brings its own sheet, not its own document
		// structure, and the error state has to land inside one here too.
		return (
			<main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">{children}</main>
		);
	}

	return (
		<div className="mx-auto w-full max-w-7xl flex-1 p-2 sm:p-6">
			{/*
			 * The sheet is a bounded object, and the border is what makes it one. A
			 * work-order ticket has an edge you could tear along; without it the same
			 * content reads as a page that merely happens to be ruled.
			 */}
			<div className="flex h-full flex-col border-2 border-rule">
				<Header />

				{/*
				 * Stacked on a phone, two columns from lg up: the margin carries the
				 * shell and the week's apparatus, the field carries the work. A single
				 * column enlarged is what a phone layout looks like on a desktop, so the
				 * extra width goes to the margin and the work keeps a readable measure.
				 *
				 * Gutters tighten below sm. At 390, 20px gutters leave the instruction
				 * column 154px wide, so one sentence wraps to seven lines and a Rule
				 * name breaks mid-word. The sheet's edge still reads at 8px.
				 *
				 * Source order is margin, work, silent rules, which is the reading a
				 * narrow screen wants. The grid placement moves the silent rules into
				 * the margin's second row on a wide screen without moving them in the
				 * DOM, so the tab order matches the reading order at every width.
				 */}
				<div className="flex flex-1 flex-col lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-stretch">
					<div className="min-w-0 px-3 pb-4 sm:px-5 lg:col-start-1 lg:row-start-1 lg:border-r-2 lg:border-rule lg:pt-6">
						<RailApparatus />
					</div>

					{/* The main landmark sits here so the error state lands inside one too.
					    The gate renders in place of the route rather than around it, so a
					    page that owned its own main would lose the landmark on exactly the
					    render where a lost reader needs it. */}
					<main className="min-w-0 px-3 pt-3 pb-6 sm:px-5 sm:py-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
						{children}
					</main>

					<div className="min-w-0 px-3 pb-6 sm:px-5 lg:col-start-1 lg:row-start-2 lg:border-r-2 lg:border-rule">
						<RailNotLit />
					</div>
				</div>
			</div>
		</div>
	);
}
