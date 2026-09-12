import type { ReactElement } from 'react';
import { WORDMARK } from './name';
import { Nav } from './nav';

/**
 * The wordmark does not link home, because the nav already points at `/` under
 * the name This Week, and two links to one route under different accessible
 * names give assistive technology two answers to one question. It is not a
 * heading either: every page owns its own h1, and a banner-level h1 would put a
 * second one on every route and break the heading order #16 runs axe against.
 */
export function Header(): ReactElement {
	return (
		<header className="border-b border-border bg-background">
			<div className="mx-auto flex max-w-3xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-3">
				<span className="text-lg font-medium tracking-tight text-foreground">{WORDMARK}</span>
				<Nav />
			</div>
		</header>
	);
}
