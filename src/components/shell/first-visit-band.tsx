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
 * guarantee is the part a stranger cannot infer from looking: every Task comes
 * from a written Rule and shows the evidence that fired it, and the model can
 * reword a Task but never add one. `Purpose` below already introduces the yard
 * and the kinds of evidence, so this must not say either again.
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

		// The button is about to leave the document, and focus left on a removed
		// node falls to <body>, which puts a keyboard reader back at the top of
		// the page. The route's heading is where the band pointed them anyway.
		const heading = document.querySelector<HTMLElement>('main h1');
		if (heading !== null) {
			heading.tabIndex = -1;
			heading.focus();
		}

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
			className="flex flex-col gap-1 border-2 border-accent px-4 pt-3 print:hidden sm:flex-row sm:items-center sm:gap-x-6 sm:py-1"
		>
			{/* Text above the links on a phone. Side by side at 390, the sentence
			    squeezes into a column 150px wide and nine lines tall. */}
			<p className="min-w-0 flex-1 font-mono text-detail text-foreground">
				<span className="font-display text-label font-bold tracking-widest text-accent uppercase">New here — </span>
				every task below comes from a written rule and shows the evidence that fired it. A model may reword a task; it cannot add one.
			</p>

			{/* `min-h-11` on each: at text height alone these are 17px tall, a third
			    of the 44px the rest of the page holds itself to. */}
			<div className="flex gap-x-6">
				<Link
					href="/about"
					className={`inline-flex min-h-11 items-center font-display text-label font-bold tracking-widest text-accent uppercase underline underline-offset-4 ${FOCUS_RING}`}
				>
					How this works
				</Link>

				<button
					type="button"
					onClick={dismiss}
					className={`inline-flex min-h-11 items-center font-display text-label font-bold tracking-widest text-muted uppercase ${FOCUS_RING}`}
				>
					Dismiss
				</button>
			</div>
		</aside>
	);
}
