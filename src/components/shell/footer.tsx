import type { ReactElement } from 'react';
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
		<footer className="border-t border-border bg-background">
			<div className="mx-auto max-w-3xl px-4 py-4">
				<p className="text-xs text-muted-foreground">{OPEN_METEO_ATTRIBUTION}</p>
			</div>
		</footer>
	);
}
