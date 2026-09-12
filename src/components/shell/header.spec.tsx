import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './header';
import { WORDMARK } from './name';

// The header renders the nav, and the nav reads the route through a client hook.
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('header', () => {
	it('shows the wordmark as plain lowercase text', () => {
		render(<Header />);

		expect(screen.getByText(WORDMARK).textContent).toBe('rootstock');
		expect(WORDMARK).toBe(WORDMARK.toLowerCase());
	});

	it('carries no logo and no tagline', () => {
		render(<Header />);

		const banner = screen.getByRole('banner');
		// Strip the nav and what remains is the header's own copy. A tagline would
		// land there and fail this assertion.
		screen.getByRole('navigation').remove();

		expect(banner.textContent?.trim()).toBe(WORDMARK);
		expect(banner.querySelectorAll('img, svg')).toHaveLength(0);
	});

	// ADR 0004: the Away Card stays reachable and unadvertised, because whether
	// the household has an away mode is the one thing the design keeps to itself.
	// A careless later edit breaks this assertion first.
	it('does not link the Away Card', () => {
		render(<Header />);

		const hrefs = screen.getAllByRole('link').map(link => link.getAttribute('href'));

		expect(hrefs).toEqual(['/', '/yard', '/rules']);
		expect(hrefs.some(href => href?.includes('away'))).toBe(false);
		expect(screen.queryByRole('link', { name: /away/i })).toBeNull();
	});
});
