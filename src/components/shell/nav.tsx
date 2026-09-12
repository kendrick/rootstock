'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Every route a visitor is offered. The Away Card is absent on purpose. Per
 * ADR 0004 it renders the same whether or not anyone is travelling, so finding
 * it tells a stranger nothing; a nav link would tell them plenty, by
 * advertising that the household has an away mode worth hunting for. This repo
 * and the deployed site are both public. Leaving the Away Card unlinked is the
 * decision, so do not "fix" it by adding a fourth entry.
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
