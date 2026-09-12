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

	// lucide-react stamps each icon's own name onto the svg as a class, so
	// this proves the two kinds render genuinely different icon shapes rather
	// than the same glyph recoloured.
	it('renders a different icon shape per kind', () => {
		const { container: extensionContainer } = render(<SourceBadge source={extensionSource} />);
		const { container: ownerContainer } = render(<SourceBadge source={ownerSource} />);

		const extensionIcon = extensionContainer.querySelector('svg');
		const ownerIcon = ownerContainer.querySelector('svg');

		expect(extensionIcon?.getAttribute('class')).toContain('lucide-landmark');
		expect(ownerIcon?.getAttribute('class')).toContain('lucide-user');
	});

	it('hides the icon from screen readers so the text is not announced twice', () => {
		const { container } = render(<SourceBadge source={extensionSource} />);

		expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
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

	it('uses a different colour for each kind, on top of the text and icon', () => {
		const { container: extensionContainer } = render(<SourceBadge source={extensionSource} />);
		const { container: ownerContainer } = render(<SourceBadge source={ownerSource} />);

		const extensionBadge = extensionContainer.firstElementChild;
		const ownerBadge = ownerContainer.firstElementChild;

		expect(extensionBadge?.getAttribute('class')).not.toBe(ownerBadge?.getAttribute('class'));
	});
});
