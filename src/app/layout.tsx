import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { Footer } from '@/components/shell/footer';
import { Header } from '@/components/shell/header';
import { WORDMARK } from '@/components/shell/name';
import './globals.css';

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
		<html lang="en">
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
