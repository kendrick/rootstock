import type { ReactElement, ReactNode } from 'react';
import { useId } from 'react';

export interface TaskGroupProps {
	heading: string;
	emptyText?: string;
	/**
	 * A line under the heading, rendered only when the group has Tasks in it.
	 * The one caller uses it for what ticking a box does, and that is advice
	 * about work on the screen: over an empty group it would be advice about
	 * nothing.
	 */
	description?: string;
	children?: ReactNode;
}

/**
 * A labelled list of Tasks. `TaskItem` renders its own `<li>` and leaves the
 * `<ul>` to whoever groups them, so this is the component that owns it.
 *
 * An empty group with no `emptyText` renders nothing at all, the same call
 * `Advisories` makes: a heading over an empty list reads as a promise the page
 * broke. Passing `emptyText` is how a caller says the absence is itself worth
 * reporting—work nobody has to do this week is news, where a look-ahead group
 * with nothing in it is not.
 *
 * The heading is an h2 and the group nests no further headings under it. The
 * route owns the page's only h1, and `tests/integration/smoke.spec.ts` runs axe
 * over the finished page, where a skipped level is a violation.
 */
export function TaskGroup({ heading, emptyText, description, children }: TaskGroupProps): ReactElement | null {
	// Two groups render on the route, so a hand-written id would appear twice in
	// one document, which axe reports as a violation. `aria-labelledby` rather
	// than an `aria-label` carrying the same words, so the region's name and the
	// visible heading cannot drift apart.
	const headingId = useId();

	// An array is what a caller's `.map()` over its Tasks hands over, and an empty
	// one is the case this has to notice. Anything else JSX passes down is a node
	// somebody meant to render, so the only other emptiness is nothing at all.
	const empty = Array.isArray(children)
		? children.length === 0
		: children === undefined || children === null;

	if (empty && emptyText === undefined) {
		return null;
	}

	return (
		<section aria-labelledby={headingId} className="space-y-3">
			<h2 id={headingId} className="font-display text-label font-bold tracking-widest text-muted uppercase">{heading}</h2>

			{!empty && description !== undefined && (
				<p className="max-w-prose text-body text-muted">{description}</p>
			)}

			{empty
				? <p className="max-w-prose text-body text-muted">{emptyText}</p>
				: <ul className="space-y-3">{children}</ul>}
		</section>
	);
}
