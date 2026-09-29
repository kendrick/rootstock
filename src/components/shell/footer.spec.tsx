import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_METEO_ATTRIBUTION } from '@/weather/open-meteo';
import { Footer } from './footer';

// usePathname wants a router jsdom can't provide, so the route is a value the
// spec sets, the way nav.spec.tsx does it.
const route = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/navigation', () => ({ usePathname: () => route.current }));

beforeEach(() => {
	route.current = '/';
});

describe('footer', () => {
	it('renders the attribution Open-Meteo licences the data under', () => {
		render(<Footer />);

		const footer = screen.getByRole('contentinfo');
		// Strip the orientation link and what remains is the attribution, verbatim.
		// The licence names the source rather than describing it, so this stays an
		// exact comparison: a footer that merely contained the text would pass a
		// looser assertion while a paraphrase slid in beside it.
		screen.getByRole('link', { name: /how this works/i }).remove();

		expect(footer.textContent).toBe(OPEN_METEO_ATTRIBUTION);
	});

	// The band above the plan is dismissed once and gone, so without this a reader
	// who dismissed it, or who arrived on a second device, has no route back to the
	// explanation. It is not in the nav, because the nav is the owner's route list
	// and the owner never needs it.
	it('offers a permanent way to the orientation page', () => {
		render(<Footer />);

		expect(screen.getByRole('link', { name: /how this works/i }).getAttribute('href')).toBe('/about');
	});

	// Open-Meteo licences the data CC BY 4.0, and the licence names the source
	// rather than describing it. A footer that paraphrased would satisfy this
	// suite while failing the licence, so the assertion above compares against
	// the exported constant; this one pins the wording that constant has to
	// carry, matching what `open-meteo.spec.ts` asserts from the other side.
	it('carries the source and the licence, not a paraphrase', () => {
		render(<Footer />);

		const attribution = screen.getByRole('contentinfo').textContent ?? '';
		expect(attribution).toContain('Open-Meteo');
		expect(attribution).toContain('CC BY 4.0');
	});

	// /about's nav reaches This Week, which names the Withheld work. SheetFrame
	// hides the nav on the card for that reason, and a footer link would walk
	// straight back round it. The licence line still has to be there.
	it('keeps only the licence line on the Away Card', () => {
		route.current = '/away/spec-only-route';
		render(<Footer />);

		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.getByRole('contentinfo').textContent).toBe(OPEN_METEO_ATTRIBUTION);
	});
});
