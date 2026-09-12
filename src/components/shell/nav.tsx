'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Every route a visitor is offered. The Away Card is absent because this
 * component has no way to name it: the route is `/away/[slug]`, the slug comes
 * from `ROOTSTOCK_AWAY_SLUG` at build time, and that variable is deliberately
 * not `NEXT_PUBLIC_`, so it never reaches the browser bundle this nav ships in.
 *
 * Not for secrecy. CONTEXT.md is clear that the card renders the same way
 * whether or not anyone is travelling, precisely so that finding it tells a
 * stranger nothing — which means linking it would give nothing away either. It
 * is simply not a section of the site. The household reaches it by its own
 * link, and a fourth entry here would need the slug in the client bundle to
 * build the href at all.
 *
 * The labels are the domain's own words. CONTEXT.md forbids Schedule, list,
 * result and output as synonyms for Plan, so This Week cannot drift into
 * Schedule here.
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
		<nav aria-label="Main">
			<ul className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
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
									'text-sm underline-offset-4 hover:underline',
									isCurrent ? 'text-foreground' : 'text-muted-foreground',
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
