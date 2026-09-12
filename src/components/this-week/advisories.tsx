import type { ReactElement } from 'react';
import { Eye } from 'lucide-react';

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
 * The distinction is carried three ways past colour alone—a dashed border
 * instead of Task's solid one, an eye glyph instead of a checkbox, and prose
 * that says outright that nothing produced this—because `source-badge.tsx`
 * already established that a colour-only signal fails a reader who can't see
 * colour, or one squinting at a phone in the yard.
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
		<section
			aria-labelledby="advisories-heading"
			className="space-y-3 rounded-md border border-dashed border-border bg-muted/40 p-4"
		>
			<div className="space-y-1">
				<h2 id="advisories-heading" className="text-base font-semibold text-foreground">
					Also observed
				</h2>
				{/* Spells out the "no Rule produced this" fact in words rather than
				    leaving it to the dashed border, so a reader who never notices the
				    border still can't mistake this for a cited Task. */}
				<p className="text-sm text-muted-foreground">
					No rule produced these—the model noticed them on its own, so none of them carries a citation.
				</p>
			</div>
			<ul className="space-y-2">
				{advisories.map(advisory => (
					<li key={advisory.text} className="flex items-start gap-2 text-sm text-foreground">
						<Eye aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
						<span>{advisory.text}</span>
					</li>
				))}
			</ul>
		</section>
	);
}
