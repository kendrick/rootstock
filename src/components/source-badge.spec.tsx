import type { Source } from '@/rules/rule';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SourceBadge } from './source-badge';

const extensionSource: Source = {
	kind: 'extension',
	label: 'Texas A&M AgriLife Extension',
	url: 'https://agrilifeextension.tamu.edu/',
};

const ownerSource: Source = {
	kind: 'owner',
	label: 'House practice',
	url: null,
};

describe('sourceBadge', () => {
	// The whole point of the component is that kind is legible without colour.
	// A test that only checked the container's class would pass on a badge
	// that used colour alone, so this reads the rendered text a sighted user
	// actually sees.
	it('renders visible text naming the kind, not just an aria-label', () => {
		render(<SourceBadge source={extensionSource} />);

		expect(screen.getByText('Extension')).toBeDefined();
		expect(screen.getByText('· Texas A&M AgriLife Extension')).toBeDefined();
	});

	it('renders different visible text for an owner source', () => {
		render(<SourceBadge source={ownerSource} />);

		expect(screen.getByText('Owner')).toBeDefined();
		expect(screen.getByText('· House practice')).toBeDefined();
		expect(screen.queryByText('Extension')).toBeNull();
	});

	// The kind used to be carried by an icon shape and a colour on top of the
	// text. Both are gone: this world has no icon system and no rounded chrome,
	// and colour here is rationed to work that was recorded. What survives is the
	// requirement underneath them, WCAG 1.4.1, that the distinction never rests on
	// colour. The word does it, and these two assertions are what would catch the
	// word being traded back for a swatch.
	it('carries no icon and no colour-only distinction', () => {
		const { container: extensionContainer } = render(<SourceBadge source={extensionSource} />);
		const { container: ownerContainer } = render(<SourceBadge source={ownerSource} />);

		expect(extensionContainer.querySelector('svg')).toBeNull();
		expect(ownerContainer.querySelector('svg')).toBeNull();

		// Strip every element's classes and the two kinds still read differently.
		const textOf = (root: HTMLElement) => root.textContent?.replace(/\s+/g, ' ').trim();
		expect(textOf(extensionContainer)).not.toBe(textOf(ownerContainer));
		expect(textOf(extensionContainer)).toContain('Extension');
		expect(textOf(ownerContainer)).toContain('Owner');
	});

	it('links the source url when present', () => {
		render(<SourceBadge source={extensionSource} />);

		const link = screen.getByRole('link');
		expect(link.getAttribute('href')).toBe('https://agrilifeextension.tamu.edu/');
	});

	it('renders without a link when the url is null', () => {
		render(<SourceBadge source={ownerSource} />);

		expect(screen.queryByRole('link')).toBeNull();
	});
});
