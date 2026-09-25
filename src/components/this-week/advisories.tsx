import type { ReactElement } from 'react';
import { Eye } from 'lucide-react';
import { Section } from './section';

export interface AdvisoriesProps {
	advisories: readonly { text: string }[];
}

/**
 * Everything else on this route is a Task, and every Task traces back to a
 * Rule through a Citation a reader can expand. An Advisory has neither: per
 * CONTEXT.md, it is "something the model observed that no Rule produced," so
 * there is nothing here to cite and nothing to check against `seedRules`.
 * Presenting it beside `TaskItem` with the same shape would tell a reader the
 * household can act on it with the same confidence, which is the one claim
 * this component exists to not make.
 *
 * The distinction is carried past colour alone: a plain list outside the
 * ruled Task table, an eye glyph where a Task has a sign-off box, and a
 * sentence saying outright that nothing produced these. `source-badge.tsx`
 * already established that a colour-only signal fails a reader who can't see
 * colour, or one squinting at a phone in the yard.
 *
 * Nothing on the sheet sits on a raised surface. #50 measured the LCP element
 * on This Week as an Advisory span when this block was the prominent one, and
 * the page's most prominent element should never be the one block carrying no
 * Citation.
 *
 * Returns null on an empty list rather than an empty heading, for the same
 * reason `TaskGroup` will: a label over nothing reads as a promise the page
 * broke, and an unnarrated Artifact carries no advisories to promise.
 */
export function Advisories({ advisories }: AdvisoriesProps): ReactElement | null {
	if (advisories.length === 0) {
		return null;
	}

	return (
		<Section id="advisories-heading" label="Also observed" emphasis>
			<ul className="space-y-2">
				{advisories.map(advisory => (
					<li key={advisory.text} className="flex items-start gap-2 text-body text-foreground">
						<Eye aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted" />
						<span className="max-w-prose">{advisory.text}</span>
					</li>
				))}
			</ul>

			{/* Spells out the "no Rule produced this" fact in words. CONTEXT.md is
			    strict that an Advisory carries no Citation and never reaches the Away
			    Card, and this section now sits above the work rather than under it, so
			    the sentence has to carry the distinction the old dashed border was
			    doing quietly. */}
			<p className="max-w-prose text-detail text-muted">
				No rule produced these. The model noticed them on its own, so none of them carries a citation, and none of them reaches the Away Card.
			</p>
		</Section>
	);
}
