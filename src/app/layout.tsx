import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { Assistant, Atkinson_Hyperlegible_Mono, Economica } from 'next/font/google';
import { Footer } from '@/components/shell/footer';
import { GRID_PREFERENCE_SCRIPT } from '@/components/shell/grid-preference';
import { Header } from '@/components/shell/header';
import { WORDMARK } from '@/components/shell/name';
import './globals.css';

/**
 * Three faces, and two of them were chosen by measurement rather than by taste.
 *
 * Economica and Assistant won the font-match ranking against the approved comp:
 * the tool measures cap height, advance width and stroke density off the render
 * and ranks a catalog against those numbers, so the face follows the design
 * instead of the design following a favourite.
 *
 * Economica ships an explicit weight pair because it has no variable axis. 400
 * and 700 are both used: 700 carries job names and the wordmark, 400 the quieter
 * labels.
 */
const economica = Economica({
	subsets: ['latin'],
	weight: ['400', '700'],
	variable: '--font-economica',
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
			className={`${economica.variable} ${assistant.variable} ${atkinsonMono.variable}`}
		>
			<body
				className="construction-grid flex min-h-dvh flex-col bg-background text-foreground [--cell:1.5rem]"
			>
				{/*
				 * Runs before anything paints. A reader who switched the construction
				 * grid off did it because the pattern behind the text was a problem for
				 * them, and showing it again for one frame on every navigation is the
				 * defect the control exists to prevent. Nothing else can do this: the
				 * preference lives in localStorage, which no server render can read.
				 */}
				{/* eslint-disable-next-line react/dom-no-dangerously-set-innerhtml -- the payload is a module constant with no interpolation of anything a reader controls; it is the only way to apply a stored preference before paint */}
				<script dangerouslySetInnerHTML={{ __html: GRID_PREFERENCE_SCRIPT }} />
				<Header />
				{/* The main landmark sits in the layout so the error state lands inside
					one too. The gate renders in place of the route rather than around
					it, so a page that owned its own main would lose the landmark on
					exactly the render where a lost reader needs it. */}
				<main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
				<Footer />
			</body>
		</html>
	);
}
