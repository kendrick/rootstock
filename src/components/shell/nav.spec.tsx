import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Nav } from './nav';

// usePathname wants a router jsdom has no way to provide, so the route is a
// value the spec sets. vi.hoisted because vi.mock is lifted above the imports
// and would otherwise close over an uninitialised binding.
const route = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/navigation', () => ({ usePathname: () => route.current }));

function renderAt(pathname: string): void {
	route.current = pathname;
	render(<Nav />);
}

describe('nav', () => {
	// ADR 0004: the Away Card stays reachable and unadvertised, because whether
	// the household has an away mode is the one thing the design keeps to itself.
	// The nav is where a careless edit would add it, so the assertion lives here.
	it('does not link the Away Card', () => {
		renderAt('/');

		const hrefs = screen.getAllByRole('link').map(link => link.getAttribute('href'));

		expect(hrefs).toEqual(['/', '/yard', '/rules']);
		expect(hrefs.some(href => href?.includes('away'))).toBe(false);
		expect(screen.queryByRole('link', { name: /away/i })).toBeNull();
	});

	it('links exactly the three routes, in order, with their domain labels', () => {
		renderAt('/');

		const links = screen.getAllByRole('link').map(link => [link.textContent, link.getAttribute('href')]);

		expect(links).toEqual([
			['This Week', '/'],
			['Yard', '/yard'],
			['Rules', '/rules'],
		]);
	});

	// Asserting that aria-current appears somewhere would pass on a nav that
	// marked all three links, so the test collects every marked link and expects
	// exactly one.
	it.each([
		['/', 'This Week'],
		['/yard', 'Yard'],
		['/rules', 'Rules'],
	])('marks %s as the current page and leaves the other links unmarked', (pathname, label) => {
		renderAt(pathname);

		const marked = screen
			.getAllByRole('link')
			.filter(link => link.getAttribute('aria-current') === 'page')
			.map(link => link.textContent);

		expect(marked).toEqual([label]);
	});

	it('marks nothing on a route the nav does not list', () => {
		renderAt('/somewhere-else');

		expect(screen.getAllByRole('link').some(link => link.hasAttribute('aria-current'))).toBe(false);
	});

	// usePathname strips the basePath before returning. A nav that compared
	// against the browser's URL would mark nothing on the deployed site, which is
	// the one place nobody runs these tests.
	it('does not expect the basePath in the route it compares against', () => {
		renderAt('/rootstock/yard');

		expect(screen.getAllByRole('link').some(link => link.hasAttribute('aria-current'))).toBe(false);
	});
});
