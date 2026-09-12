import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OPEN_METEO_ATTRIBUTION } from '@/weather/open-meteo';
import { Footer } from './footer';

describe('footer', () => {
	it('renders the attribution Open-Meteo licences the data under', () => {
		render(<Footer />);

		expect(screen.getByRole('contentinfo').textContent).toBe(OPEN_METEO_ATTRIBUTION);
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
});
