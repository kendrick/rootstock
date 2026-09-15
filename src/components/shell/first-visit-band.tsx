'use client';

import type { ReactElement } from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FOCUS_RING } from '@/lib/focus';
import { ORIENTED_STORAGE_KEY } from './orientation';

/**
 * The one thing on this page addressed to somebody who has never seen it.
 *
 * This Week states the plan. It does not establish what produced it or why a
 * reader should believe it, and arriving cold on a list of chemical
 * applications with no account of where they came from is the disorientation
 * this exists to fix.
 *
 * It says what the page guarantees rather than what the product is, because the
 * guarantee is the part a stranger cannot infer from looking: every job names
 * the Rule that asked for it and the dated reading that fired it. `Purpose`
 * below already introduces the yard, so this must not say that again.
 *
 * Dismissed once and gone. The daily reader is the primary audience and owes
 * nothing to a banner; the cold arrival is secondary but real. The dismissal is
 * per browser, so a new device shows it again, which is the correct behaviour
 * for a household where the card gets opened on somebody else's phone.
 */
export function FirstVisitBand(): ReactElement | null {
	// Starts hidden and appears after mount. The route is prerendered at build
	// time (`output: 'export'`), so a band rendered server-side would ship in the
	// HTML and flash for every reader who had already dismissed it.
	const [show, setShow] = useState(false);

	useEffect(() => {
		// eslint-disable-next-line react/set-state-in-effect -- the answer lives in localStorage, which no prerender can read
		setShow(document.body.dataset.oriented !== '1');
	}, []);

	function dismiss(): void {
		setShow(false);
		document.body.dataset.oriented = '1';

		try {
			localStorage.setItem(ORIENTED_STORAGE_KEY, '1');
		}
		catch {}
	}

	if (!show) {
		return null;
	}

	return (
		<aside
			aria-label="New here"
			className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-2 border-accent px-4 py-3 print:hidden"
		>
			<p className="min-w-0 flex-1 font-mono text-detail text-foreground">
				<span className="font-display text-label font-bold tracking-widest text-accent uppercase">New here — </span>
				every job below names the rule that asked for it and the dated reading that fired it. Nobody typed them in.
			</p>

			<Link
				href="/about"
				className={`font-display text-label font-bold tracking-widest text-accent uppercase underline underline-offset-4 ${FOCUS_RING}`}
			>
				How this works
			</Link>

			<button
				type="button"
				onClick={dismiss}
				className={`font-display text-label font-bold tracking-widest text-muted uppercase ${FOCUS_RING}`}
			>
				Dismiss
			</button>
		</aside>
	);
}
