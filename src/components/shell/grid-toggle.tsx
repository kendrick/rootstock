'use client';

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { FOCUS_RING } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { GRID_STORAGE_KEY } from './grid-preference';

/**
 * Switches the construction grid off and on.
 *
 * This is an accessibility escape hatch wearing a design control's clothes. The
 * grid is the identity of this surface and it sits permanently behind body
 * copy, which is a real problem for visual stress and low vision. The control
 * is how a reader turns it off; `prefers-contrast: more` turns it off in CSS
 * without anyone asking.
 *
 * It does nothing else, deliberately. It was a candidate for exposing the whole
 * rule set and for unfolding full citation detail, and both of those already
 * have homes: the rule set belongs to /rules, and citation detail to the
 * disclosure each Task already carries.
 */
export function GridToggle(): ReactElement {
	// Starts null rather than true so the first client render can tell "nobody
	// has answered yet" from "the reader chose on". The button renders from the
	// DOM's own state below, so there is nothing to get wrong before this lands.
	const [on, setOn] = useState<boolean | null>(null);

	useEffect(() => {
		// eslint-disable-next-line react/set-state-in-effect -- the DOM is the source of truth here: the pre-paint script may already have set this, and only a browser can say so
		setOn(document.body.dataset.grid !== 'off');
	}, []);

	function toggle(): void {
		const next = document.body.dataset.grid === 'off';

		if (next) {
			delete document.body.dataset.grid;
		}
		else {
			document.body.dataset.grid = 'off';
		}

		setOn(next);

		// A preference that does not survive a reload is not a preference. Failure
		// is swallowed on purpose: private mode still gets the toggle for this
		// session, which is better than a control that throws.
		try {
			localStorage.setItem(GRID_STORAGE_KEY, next ? 'on' : 'off');
		}
		catch {}
	}

	return (
		<button
			type="button"
			onClick={toggle}
			// The button reports pressed state rather than being labelled twice. Until
			// the effect has run there is no honest answer, so the attribute stays off
			// the DOM instead of asserting a default nobody chose.
			aria-pressed={on ?? undefined}
			// The visible label is the abbreviation the corner has room for. The
			// accessible name says the whole thing, and aria-pressed above carries
			// the state, which a label alone cannot.
			aria-label="Construction grid"
			className={cn(
				'grid size-11 shrink-0 place-items-center font-display text-[0.6875rem] font-bold tracking-widest uppercase print:hidden',
				FOCUS_RING,
				on === false
					? 'border border-rule text-foreground'
					: 'bg-accent text-accent-foreground',
			)}
		>
			Grid
		</button>
	);
}
