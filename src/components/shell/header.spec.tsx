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
		// And strip the grid control, for the same reason and not a weaker one.
		// What this test protects is the wordmark standing alone against branding:
		// no logo, no tagline, nothing competing for the name's place. A control is
		// neither, and the approved comp puts this one in the header's top-right
		// corner, so moving it out to satisfy a string comparison would recompose an
		// approved design to keep a test convenient. Its presence is pinned below
		// instead, which is the assertion that would actually catch it going missing.
		screen.getByRole('button', { name: /grid/i }).remove();

		expect(banner.textContent?.trim()).toBe(WORDMARK);
		expect(banner.querySelectorAll('img, svg')).toHaveLength(0);
	});

	// The construction grid sits permanently behind body copy, which is a real
	// problem for visual stress and low vision, and this control is the reader's
	// way out of it. That makes it an accessibility affordance rather than a
	// preference toy, so losing it silently is the failure worth a test.
	it('offers the grid control as a real pressable button', () => {
		render(<Header />);

		const toggle = screen.getByRole('button', { name: /grid/i });

		expect(toggle).toBeTruthy();
		expect(toggle.tagName).toBe('BUTTON');
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
