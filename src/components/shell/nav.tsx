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
 * The labels are the domain's own words. Plan is what the Planner returns for
 * one date, so it names the route the Plan is read on; CONTEXT.md forbids
 * Schedule, list, result and output as synonyms, and none of them appear.
 */
const ROUTES = [
	{ href: '/', label: 'Plan' },
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
			<ul className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
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
									// The active route is marked by a rule beneath it rather than
									// by colour alone, so the distinction survives both a
									// greyscale print and a reader who cannot separate the accent
									// from the ink (1.4.1).
									'inline-block pb-1 font-display text-label font-bold tracking-widest uppercase',
									FOCUS_RING,
									isCurrent
										? 'border-b-2 border-accent text-accent'
										: 'border-b-2 border-transparent text-foreground hover:border-rule-faint',
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
