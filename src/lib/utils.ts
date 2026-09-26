// Copy to `lib/utils.ts` in the consuming project.

import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * The `--text-*` sizes in globals.css, named here because tailwind-merge
 * can't read the stylesheet. An unknown `text-*` class counts as a colour, so
 * without this list `text-title text-foreground` merges to `text-foreground`
 * and the size silently falls back to 16px. A new size token goes in both
 * places, and `utils.spec.ts` lists them again.
 */
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			text: ['wordmark', 'display', 'title', 'heading', 'body', 'note', 'label', 'evidence', 'callout'],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
