import type { ReactElement, ReactNode } from 'react';
import { useId } from 'react';
import { Section } from './section';

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
	/** Lets the rows point `aria-describedby` at the description, so the warning is read with the control. */
	descriptionId?: string;
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
export function TaskGroup({ heading, emptyText, description, descriptionId, children }: TaskGroupProps): ReactElement | null {
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
		<Section id={headingId} label={heading}>
			{!empty && description !== undefined && (
				<p id={descriptionId} className="max-w-prose text-detail text-muted">{description}</p>
			)}
			{empty
				? <p className="max-w-prose text-body text-muted">{emptyText}</p>
				: (
						<div className="border-2 border-rule">
							{/* The column heads. aria-hidden because the columns are a printed
							    convention rather than a table a screen reader should announce:
							    each row below is one list item carrying its own labelled parts,
							    and a reader moving by list gets the Task, the target and the
							    control in that order without the header repeating itself. */}
							<div
								aria-hidden="true"
								className="grid grid-cols-[2.5rem_minmax(0,1fr)_6.5rem] sm:grid-cols-[3.25rem_minmax(0,1fr)_6.5rem] border-b-2 border-rule font-display text-label font-bold tracking-widest uppercase"
							>
								<span className="border-r-2 border-rule px-2 py-1.5 text-center">Task</span>
								<span className="px-3 py-1.5">Target</span>
								<span className="border-l-2 border-rule px-2 py-1.5 text-center">Sign off</span>
							</div>

							<ul>{children}</ul>
						</div>
					)}
		</Section>
	);
}
