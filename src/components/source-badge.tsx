import type { ReactElement } from 'react';
import type { Source } from '@/rules/rule';
import { Landmark, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * The word for each `kind`, rendered on the page rather than left to an
 * aria-label. A sighted reader never hears an aria-label, and a reader with a
 * colour-vision deficiency (or one squinting at a phone in the yard) still
 * needs to tell an extension recommendation from the owner's own practice —
 * see the `sourceSchema` docblock in rule.ts for why the two carry different
 * weight.
 */
const KIND_TEXT: Record<Source['kind'], string> = {
	extension: 'Extension',
	owner: 'Owner',
};

// A university extension office is an institution; the owner is a person.
// The icon shapes follow that distinction so it survives on a screen that
// can't render colour, not just on one that can.
const KIND_ICON: Record<Source['kind'], typeof Landmark> = {
	extension: Landmark,
	owner: User,
};

export function SourceBadge({ source }: { source: Source }): ReactElement {
	const Icon = KIND_ICON[source.kind];

	const content = (
		<>
			<Icon aria-hidden="true" className="size-3.5 shrink-0" />
			<span className="font-semibold">{KIND_TEXT[source.kind]}</span>
			<span className="font-normal">{`· ${source.label}`}</span>
		</>
	);

	return (
		<Badge
			variant={source.kind === 'extension' ? 'default' : 'secondary'}
			className="gap-1.5"
		>
			{source.url === null
				? (
						content
					)
				: (
						<a
							href={source.url}
							target="_blank"
							rel="noopener noreferrer"
							className={cn(
								'inline-flex items-center gap-1.5 rounded-sm outline-none',
								'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
							)}
						>
							{content}
						</a>
					)}
		</Badge>
	);
}
