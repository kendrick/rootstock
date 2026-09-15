import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { Assistant, Atkinson_Hyperlegible_Mono, Saira_Condensed } from 'next/font/google';
import { Footer } from '@/components/shell/footer';
import { WORDMARK } from '@/components/shell/name';
import { SheetFrame } from '@/components/shell/sheet-frame';
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

				<SheetFrame>{children}</SheetFrame>

				<Footer />
			</body>
		</html>
	);
}
