'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FOCUS_RING } from '@/lib/focus';
import { cn } from '@/lib/utils';

/**
 * Every route a visitor is offered. The Away Card is absent because this
 * component has no way to name it: the route is `/away/[slug]`, the slug comes
 * from `ROOTSTOCK_AWAY_SLUG` at build time, and that variable is deliberately
 * not `NEXT_PUBLIC_`, so it never reaches the browser bundle this nav ships in.
 *
 * Not for secrecy. CONTEXT.md is clear that the card renders the same way
 * whether or not anyone is travelling, precisely so that finding it tells a
 * stranger nothing—which means linking it would give nothing away either. It
 * is simply not a section of the site. The household reaches it by its own
 * link, and a fourth entry here would need the slug in the client bundle to
 * build the href at all.
 *
 * The labels are the domain's own words, and each matches the heading of the
 * route it opens. The first says This Week, the route's name in PRODUCT.md and
 * a CONTEXT.md term in its own right. Plan is a domain word too, but a reader
 * who taps PLAN lands on a page titled THIS WEEK, and the owner ruled for the
 * route's name on 2026-09-25. Plan stays in prose ("Planned Sep 25"), where it
 * names the thing the Planner returned.
 */
const ROUTES = [
	{ href: '/', label: 'This Week' },
	{ href: '/yard', label: 'Yard' },
	{ href: '/rules', label: 'Rules' },
] as const;

export function Nav(): ReactElement {
	// next.config.ts sets basePath '/rootstock', which usePathname strips before
	// returning, so the comparison below uses the bare href rather than the URL
	// the browser shows.
	const pathname = usePathname();

	return (
		// print:hidden because a paper reader cannot follow a link. #63 is the one
		// route this rule actually reaches: Plan, Yard and Rules have no print path
		// today, so the nav they carry never meets it.
		<nav aria-label="Main" className="mt-3 print:hidden">
			{/* Tighter in the lg margin, which is 200px of text wide. At gap-x-8 the
			    three labels overrun it and RULES drops to a line of its own. */}
			<ul className="flex flex-wrap items-baseline gap-x-8 gap-y-2 lg:gap-x-4">
				{ROUTES.map(({ href, label }) => {
					const isCurrent = pathname === href;

					return (
						<li key={href}>
							<Link
								href={href}
								// aria-current on every link tells a screen reader nothing, so
								// only the active link carries it. undefined keeps the
								// attribute off the DOM; React renders aria-current={false} as
								// the string "false", which reads as present.
								aria-current={isCurrent ? 'page' : undefined}
								className={cn(
									// The active route is marked by a rule beneath it and full ink
									// against the others' lighter printing, never by colour alone
									// (1.4.1). Stamp red marks only recorded work, so the nav stays ink.
									// 44px tall, the page's own target size; the rule still sits
									// under the word.
									'inline-flex min-h-11 items-end pb-1 font-display text-label font-extrabold tracking-widest uppercase',
									FOCUS_RING,
									isCurrent
										? 'border-b-2 border-foreground text-foreground'
										: 'border-b-2 border-transparent text-muted hover:border-rule-faint hover:text-foreground',
								)}
							>
								{label}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
