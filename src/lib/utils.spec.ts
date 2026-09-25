import { describe, expect, it } from 'vitest';
import { cn } from './utils';

// globals.css defines these as `--text-*` sizes. Stock tailwind-merge doesn't
// know them, so it filed `text-title` with the colours and dropped it whenever
// `text-foreground` came after: the sheet title rendered at 16px, below the
// Rule names inside it.
const SIZE_TOKENS = ['wordmark', 'display', 'title', 'body', 'label', 'evidence', 'detail'];

describe('cn', () => {
	it.each(SIZE_TOKENS)('keeps text-%s beside a colour', (token) => {
		expect(cn(`text-${token} text-foreground`).split(' ')).toEqual([`text-${token}`, 'text-foreground']);
	});

	// Still a size, so a caller's size overrides the component's.
	it('lets a later size replace a size token', () => {
		expect(cn('text-label', 'text-title')).toBe('text-title');
		expect(cn('text-title', 'text-sm')).toBe('text-sm');
	});

	it('lets a later colour replace a colour', () => {
		expect(cn('text-label text-muted', 'text-foreground')).toBe('text-label text-foreground');
	});
});
