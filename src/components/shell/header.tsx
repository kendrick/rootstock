import type { ReactElement } from 'react';
import { GridToggle } from './grid-toggle';
import { WORDMARK } from './name';
import { Nav } from './nav';

/**
 * The shell's top edge: the wordmark, the grid control, and the nav beneath
 * them.
 *
 * No bottom border. In this world a hairline is a structural division that
 * lands on a grid line, and spending one here would divide the header from the
 * plan when they are the same sheet. The tally band below is what the eye stops
 * at.
 */
export function Header(): ReactElement {
	return (
		<header className="mx-auto w-full max-w-5xl px-6 pt-5">
			<div className="flex items-start justify-between gap-4">
				{/* print:text-black because --accent is tuned against the screen grounds
				    and paper is neither of them; the print block in globals.css already
				    flattens the token, and this keeps the wordmark honest if that
				    override is ever scoped tighter. */}
				<span className="font-display text-wordmark leading-none font-bold tracking-tight text-foreground print:text-black">
					{WORDMARK}
				</span>
				<GridToggle />
			</div>
			<Nav />
		</header>
	);
}
