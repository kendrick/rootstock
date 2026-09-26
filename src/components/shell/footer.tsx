import type { ReactElement } from 'react';
import Link from 'next/link';
import { OPEN_METEO_ATTRIBUTION } from '@/weather/open-meteo';

/**
 * Open-Meteo licences its data CC BY 4.0, which requires attribution wherever
 * the data appears, and the data reaches nearly every route. The shell carries
 * the line once rather than each view remembering to. The sentence is imported
 * and never retyped: the adapter's spec asserts on its wording, and a second
 * copy here would drift from the one the licence requires.
 */
export function Footer(): ReactElement {
	return (
		<footer className="border-t-2 border-rule bg-background">
			<div className="mx-auto w-full max-w-7xl px-6 py-4">
				{/* print:text-black: --muted-foreground is tuned for a dark surface, so
				    the licence line would print as pale grey noise rather than ink a
				    reader can actually read. */}
				<div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
					<p className="font-mono text-evidence text-muted print:text-black">{OPEN_METEO_ATTRIBUTION}</p>

					{/* The permanent way to the orientation page. The band above the plan
					    is dismissed once and gone, which would otherwise leave a reader who
					    dismissed it, or who arrived on a second device, with no route back
					    to the explanation. It is not in the nav because the nav is the
					    owner's route list and they never need this. */}
					<Link
						href="/about"
						className="font-display text-label font-extrabold tracking-widest text-muted uppercase underline underline-offset-4 print:hidden"
					>
						How this works
					</Link>
				</div>
			</div>
		</footer>
	);
}
