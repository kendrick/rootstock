import type { ReactElement } from 'react';
import type { Source } from '@/rules/rule';
import { FOCUS_RING } from '@/lib/focus';
import { cn } from '@/lib/utils';

const KIND_TEXT: Record<Source['kind'], string> = {
	extension: 'Extension',
	owner: 'Owner',
};

/**
 * Where a Rule came from, set as printed text rather than drawn as a pill.
 *
 * This used to be a bordered badge with a small line-art glyph. Both belonged to
 * the shell that preceded this one; a work-order ticket has no rounded chrome
 * and no icon system, and a form states its provenance in a line of type the way
 * it states everything else.
 *
 * The kind carries weight and the label does not, which is the whole
 * distinction: an extension service and the owner's own practice are different
 * authorities, and a reader has to be able to tell them apart without relying on
 * colour. The words do that on their own.
 */
export function SourceBadge({ source }: { source: Source }): ReactElement {
	const content = (
		<>
			<span className="font-bold">{KIND_TEXT[source.kind]}</span>
			<span>{` · ${source.label}`}</span>
		</>
	);

	return (
		<span className="font-display text-label tracking-widest text-muted uppercase">
			{source.url === null
				? content
				: (
						<a
							href={source.url}
							target="_blank"
							rel="noopener noreferrer"
							className={cn('underline underline-offset-4', FOCUS_RING)}
						>
							{content}
						</a>
					)}
		</span>
	);
}
