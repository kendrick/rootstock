import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { Atkinson_Hyperlegible_Next } from 'next/font/google';
import { Footer } from '@/components/shell/footer';
import { Header } from '@/components/shell/header';
import { WORDMARK } from '@/components/shell/name';
import './globals.css';

/**
 * This plan gets read one-handed and outdoors in full sun, so the shell uses a
 * typeface drawn for legibility rather than for style: Atkinson Hyperlegible
 * Next comes from the Braille Institute and separates the characters that
 * collapse into each other at a glance, which matters on a page of rule ids,
 * dates and product-label numbers.
 *
 * `next/font/google` self-hosts the file at build time, so the static export
 * sends no request to Google and causes no layout shift. One variable file
 * covers weight 200 to 800, which is what lets globals.css open the type scale
 * without shipping a second weight.
 *
 * The custom property is not named --font-sans, because globals.css maps
 * Tailwind's --font-sans onto it and a property that resolves to itself is
 * circular.
 *
 * The build warns that it found no font override values for this family and
 * skipped the adjusted fallback, because Next's metrics table predates it. That
 * is a known cost, not a misconfiguration: the file is preloaded from our own
 * origin at roughly 34KB, so it is normally in hand before first paint, and
 * `display: 'swap'` is left at its default rather than moving to `optional`
 * because a reader who gets the system font instead loses the one property this
 * typeface was chosen for.
 */
const atkinson = Atkinson_Hyperlegible_Next({
	subsets: ['latin'],
	variable: '--font-atkinson',
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
		<html lang="en" className={atkinson.variable}>
			{/* Every route here is a single placeholder line until #12 through #15
			    fill them. Without the column, the footer would float halfway up the
			    viewport on all three. */}
			<body className="flex min-h-dvh flex-col bg-background text-foreground">
				<Header />
				{/* The main landmark sits in the layout so the error state lands inside
				    one too. The gate renders in place of the route rather than around
				    it, so a page that owned its own main would lose the landmark on
				    exactly the render where a lost reader needs it. */}
				<main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
				<Footer />
			</body>
		</html>
	);
}
