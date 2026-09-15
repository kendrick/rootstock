import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { Assistant, Atkinson_Hyperlegible_Mono, Saira_Condensed } from 'next/font/google';
import { Footer } from '@/components/shell/footer';
import { Header } from '@/components/shell/header';
import { WORDMARK } from '@/components/shell/name';
import { RailApparatus, RailNotLit } from '@/components/shell/rail';
import './globals.css';

/**
 * The ticket's own lettering: a heavy condensed grotesque, the face a work-order
 * form is actually printed in.
 *
 * Economica won the font-match ranking here and had to go anyway. The ranking
 * measures cap height, advance width and stroke density, and it got the
 * proportions right while missing what the genre needs: Economica is a light,
 * elegant condensed, and a ticket head set in it reads as a magazine standfirst.
 * A form's lettering is heavy enough to survive being printed badly on cheap
 * stock, which is the whole character of the thing.
 *
 * 800 rather than 900 because 900 closes the counters at the sizes the wordmark
 * runs, and 600 carries the quieter labels.
 */
const display = Saira_Condensed({
	subsets: ['latin'],
	weight: ['600', '800'],
	variable: '--font-display-face',
});

const assistant = Assistant({
	subsets: ['latin'],
	weight: 'variable',
	variable: '--font-assistant',
});

/**
 * The one face chosen against the ranking, and the reason is a product
 * constraint rather than a preference. PRODUCT.md records a binding need for
 * characters that stay distinct where rule ids, dates and product-label figures
 * are read down a column and compared with their neighbours, outdoors, at a
 * glance. That is precisely the evidence line and nowhere else, so this face
 * carries evidence only and never body copy.
 *
 * The metric winner for that region was unusable anyway: the region boxes at the
 * spec's grid resolution could not separate a task's title from its instruction
 * from its evidence, so the measurement came back mixed and ranked serif faces
 * against a monospaced line.
 */
const atkinsonMono = Atkinson_Hyperlegible_Mono({
	subsets: ['latin'],
	weight: 'variable',
	variable: '--font-atkinson-mono',
});

export const metadata: Metadata = {
	title: WORDMARK,
	description: 'Yard tasks, each one cited to the rule and the reading that produced it.',
};

// Props are typed by hand rather than with Next's generated `LayoutProps<'/'>`,
// which only exists in .next/types once a build has run. Depending on it makes
// `tsc --noEmit` require a prior `next build`, so a clean checkout cannot
// typecheck and CI fails on any order that lints before it builds.
export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
	return (
		<html
			lang="en"
			className={`${display.variable} ${assistant.variable} ${atkinsonMono.variable}`}
		>
			<body
				className="flex min-h-dvh flex-col bg-background text-foreground"
			>
				{/*
				 * The sheet: a margin and a field.
				 *
				 * Stacked on a phone, two columns from lg up, where the margin carries
				 * the shell and the week's apparatus and the field carries the work. A
				 * single column enlarged is what a phone layout looks like on a desktop,
				 * so the extra width goes to the margin and the work keeps a readable
				 * measure.
				 *
				 * Source order is margin, work, silent rules, which is the reading a
				 * narrow screen wants. The grid placement moves the silent rules into
				 * the margin's second row on a wide screen without moving them in the
				 * DOM, so the tab order matches the reading order at every width.
				 */}
				{/*
				 * The two carbonless copies under the top sheet, showing as edges across
				 * its whole width. It is the one decorative mark in this world and it
				 * appears once, at the head of the sheet, because a stack of work-order
				 * forms is what the genre looks like before anything is written on it.
				 */}
				<div aria-hidden="true" className="print:hidden">
					<div className="h-1 bg-copy-canary" />
					<div className="h-1 bg-copy-pink" />
				</div>

				{/*
				 * The sheet is a bounded object, and the border is what makes it one. A
				 * work-order ticket has an edge you could tear along; without it the same
				 * content reads as a page that merely happens to be ruled.
				 */}
				<div className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
					<div className="flex h-full flex-col border-2 border-rule">
						<Header />

						<div className="flex flex-1 flex-col lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-stretch">
							<div className="min-w-0 px-5 pb-4 lg:col-start-1 lg:row-start-1 lg:border-r-2 lg:border-rule lg:px-5 lg:pt-6">
								<RailApparatus />
							</div>

							{/* The main landmark sits in the layout so the error state lands inside
						one too. The gate renders in place of the route rather than around
						it, so a page that owned its own main would lose the landmark on
						exactly the render where a lost reader needs it. */}
							<main className="min-w-0 px-5 py-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">{children}</main>

							<div className="min-w-0 px-5 pb-6 lg:col-start-1 lg:row-start-2 lg:border-r-2 lg:border-rule">
								<RailNotLit />
							</div>
						</div>
					</div>
				</div>
				<Footer />
			</body>
		</html>
	);
}
