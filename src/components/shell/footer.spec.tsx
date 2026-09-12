import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OPEN_METEO_ATTRIBUTION } from '@/weather/open-meteo';
import { Footer } from './footer';

describe('footer', () => {
	it('renders the attribution Open-Meteo licences the data under', () => {
		render(<Footer />);

		expect(screen.getByRole('contentinfo').textContent).toBe(OPEN_METEO_ATTRIBUTION);
	});

	// The footer reads no route and takes no props, which is how the attribution
	// reaches every page without each view remembering to render it.
	it('needs nothing from the route to render', () => {
		render(<Footer />);

		expect(screen.getByText(OPEN_METEO_ATTRIBUTION)).toBeDefined();
	});
});
