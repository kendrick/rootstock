import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Header } from './header';
import { WORDMARK } from './name';

describe('header', () => {
	it('shows the wordmark as plain lowercase text', () => {
		render(<Header />);

		expect(screen.getByText(WORDMARK).textContent).toBe('rootstock');
		expect(WORDMARK).toBe(WORDMARK.toLowerCase());
	});

	it('carries no logo and no tagline', () => {
		render(<Header />);

		const banner = screen.getByRole('banner');
		// Strip the ticket number, for the same reason and not a weaker one.
		// What this test protects is the wordmark standing alone against branding:
		// no logo, no tagline, nothing competing for the name's place. A ticket
		// number is an identifier the genre requires, not a mark of identity, and
		// its presence is pinned separately below.
		screen.getByText(/^No\. \d{4}-\d{3}$/).remove();
		// And the yard line, which names the region the ticket is written for. It is
		// a field on the form, not a strapline under the name.
		screen.getByText(/Zone/).remove();

		expect(banner.textContent?.trim()).toBe(WORDMARK);
		expect(banner.querySelectorAll('img, svg')).toHaveLength(0);
	});

	// A work-order ticket is identified by a number, and the sheet carries one.
	// It is derived from the day of the year rather than stored, so the assertion
	// checks the shape rather than a value that changes every morning.
	it('carries a ticket number', () => {
		render(<Header />);

		expect(screen.getByText(/^No\. \d{4}-\d{3}$/)).toBeTruthy();
	});
});
