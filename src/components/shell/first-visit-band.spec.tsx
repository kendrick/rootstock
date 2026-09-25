import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FirstVisitBand } from './first-visit-band';

vi.mock('next/link', () => ({
	default: ({ children, href, className }: { children: string; href: string; className: string }) => <a href={href} className={className}>{children}</a>,
}));

describe('firstVisitBand', () => {
	// The button leaves the document on click, and focus on a removed node falls
	// to <body>, which puts a keyboard reader back at the top of the page.
	it('hands focus to the route heading when dismissed', async () => {
		delete document.body.dataset.oriented;
		await act(async () => {
			render(
				<main>
					<FirstVisitBand />
					<h1>This Week</h1>
				</main>,
			);
		});

		fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

		expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
		expect(screen.queryByRole('complementary', { name: 'New here' })).toBeNull();
	});

	// 17px tall at text height, a third of the page's own 44px standard.
	it('gives both controls a 44px target', async () => {
		delete document.body.dataset.oriented;
		await act(async () => {
			render(<FirstVisitBand />);
		});

		expect(screen.getByRole('button', { name: 'Dismiss' }).className).toContain('min-h-11');
		expect(screen.getByRole('link', { name: 'How this works' }).className).toContain('min-h-11');
	});
});
