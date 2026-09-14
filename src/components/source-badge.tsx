import type { ReactElement } from 'react';
import type { Source } from '@/rules/rule';
import { Landmark, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FOCUS_RING } from '@/lib/focus';
import { cn } from '@/lib/utils';

/**
 * The word for each `kind`, rendered on the page rather than left to an
 * aria-label. A sighted reader never hears an aria-label, and a reader with a
 * colour-vision deficiency (or one squinting at a phone in the yard) still
 * needs to tell an extension recommendation from the owner's own practice—see
 * the `sourceSchema` docblock in rule.ts for why the two carry different
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

/**
 * Extension sources used to take `default`, the primary-action variant, which
 * resolves to a solid white pill and made provenance the loudest thing in the
 * app: six of them stacked down the plant sheet outshouting the rule names they
 * belong to. Provenance is not a primary action. `evidence` marks it with the
 * one hue that means "this line is cited" and lets the rule name win again. The
 * icon and the word still carry the distinction on their own, so a reader who
 * sees no colour loses nothing.
 */
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
			variant={source.kind === 'extension' ? 'evidence' : 'secondary'}
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
							className={cn('inline-flex items-center gap-1.5 rounded-sm', FOCUS_RING)}
						>
							{content}
						</a>
					)}
		</Badge>
	);
}
