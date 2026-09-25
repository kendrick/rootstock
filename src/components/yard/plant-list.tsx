import type { ReactElement } from 'react';
import type { TicketLine } from './week-work';
import type { Plant } from '@/yard/plant';
import { cn } from '@/lib/utils';
import { KIND_TEXT } from './kind-text';
import { ticketLabel } from './week-work';

export type YardView = 'week' | 'all';

/**
 * Two containers on the same patio (see the hibiscus pair in the seed) look
 * identical until this word tells them apart, so it is never left implicit in
 * styling alone.
 *
 * `plant-sheet.tsx` keeps an identical copy, which is a duplicate nobody is
 * happy about. Exporting it from here trips `react-refresh/only-export-components`,
 * since a module holding components may not also export a constant, and #13 owns
 * no shared non-component module to move it to. `rule-summary.tsx` shows the
 * third way out, an eslint-disable with a written reason, and the trade it names
 * is a full dev reload on every edit to the file. Four words did not seem worth
 * that; a shared module still would be.
 *
 * The risk the copy carries is a row and the sheet it opens naming one Plant two
 * different things, so the two lists are edited together until there is
 * somewhere to put this.
 */

/**
 * One row's worth of identifying detail. Rendered as text rather than an
 * aria-label so a sighted reader on a phone in the yard sees the same thing a
 * screen reader announces, matching the house rule from `SourceBadge`.
 */
function PlantRow({ plant, ordinal, hovered, onHoverChange, onSelect, lines, ruleNames, view }: {
	plant: Plant;
	ordinal: number;
	/** This week's ticket lines naming this Plant. Empty when it has none. */
	lines: readonly TicketLine[];
	ruleNames: ReadonlyMap<string, string>;
	view: YardView;
	/** True while this Plant is under the pointer here or on its callout above. */
	hovered: boolean;
	onHoverChange: (plantId: string | null) => void;
	onSelect: (plant: Plant, trigger: HTMLElement) => void;
}): ReactElement {
	return (
		<li className="border-b-2 border-rule last:border-b-0">
			<button
				type="button"
				onClick={event => onSelect(plant, event.currentTarget)}
				onPointerEnter={() => onHoverChange(plant.id)}
				onPointerLeave={() => onHoverChange(null)}
				onFocus={() => onHoverChange(plant.id)}
				onBlur={() => onHoverChange(null)}
				className={cn(
					'grid w-full cursor-pointer grid-cols-[3.25rem_minmax(0,1fr)] items-stretch text-left transition-colors',
					'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none',
					// The row lights with its callout. Keyboard focus drives it too, so a
					// reader tabbing the list still sees which Plant on the plate they are
					// standing on, which is the half a pointer-only link would lose.
					hovered && 'bg-rule-faint/50',
					// Quieter, never hidden: the yard still reads as a whole in the
					// week view. Muted tokens rather than opacity, so contrast holds.
					view === 'week' && lines.length === 0 && 'text-muted [--foreground:var(--muted-foreground)]',
				)}
			>
				{/* The number that keys this row to its callout on the plate above. */}
				<span aria-hidden="true" className="flex items-start justify-center border-r-2 border-rule px-2 py-3 font-display text-title leading-none font-extrabold tabular-nums">
					{String(ordinal).padStart(2, '0')}
				</span>

				<span className="flex flex-col gap-1 px-3 py-3">
					<span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<span className="font-display text-title leading-[1.1] font-extrabold tracking-wide wrap-anywhere text-foreground uppercase">{plant.name}</span>
						{plant.status === 'planned' && (
							<span className="font-display font-semibold text-label tracking-widest text-muted uppercase">Planned</span>
						)}
					</span>
					{/* Assistant, because a site is the owner's description of a place,
					    a sentence rather than a reading. */}
					<span className="text-note text-muted">
						{plant.site === null ? KIND_TEXT[plant.kind] : `${KIND_TEXT[plant.kind]} · ${plant.site}`}
					</span>
					{/*
					 * What joins the Yard to the week. In the week view each line names
					 * the ticket line it is, numbered as This Week numbers it; in the
					 * inventory view one line says how much there is. Ink, not stamp
					 * red: nothing here has been recorded.
					 */}
					{lines.length > 0 && (view === 'week'
						? lines.map(line => (
								<span key={`${line.group}-${line.ordinal}`} className="font-display text-label font-extrabold tracking-widest text-foreground uppercase">
									{`On the ticket · ${ticketLabel(line)} · ${ruleNames.get(line.ruleId) ?? line.ruleId}`}
								</span>
							))
						: (
								<span className="font-display text-label font-extrabold tracking-widest text-foreground uppercase">
									{lines.length === 1 ? '1 task this week' : `${lines.length} tasks this week`}
								</span>
							))}
				</span>
			</button>
		</li>
	);
}

/**
 * The list is the equivalent path to every Plant for anyone not using the
 * photo: assistive technology, a keyboard, and the planned Plants that carry
 * no `position` and so have no pin to click. Rendering every Plant here,
 * position or not, is what keeps that path equivalent rather than partial.
 */
export function PlantList({ plants, ordinals, hovered, onHoverChange, onSelect, lines = new Map(), ruleNames = new Map(), view = 'all' }: {
	plants: Plant[];
	lines?: ReadonlyMap<string, readonly TicketLine[]>;
	ruleNames?: ReadonlyMap<string, string>;
	view?: YardView;
	/** Plant id to the number its callout carries on the plate above. */
	ordinals: ReadonlyMap<string, number>;
	/** The Plant under the pointer, here or on the plate above. */
	hovered: string | null;
	onHoverChange: (plantId: string | null) => void;
	onSelect: (plant: Plant, trigger: HTMLElement) => void;
}): ReactElement {
	const withWork = (plant: Plant): boolean => (lines.get(plant.id)?.length ?? 0) > 0;
	const ordered = view === 'week' ? plants.filter(withWork) : plants;
	const rest = view === 'week' ? plants.filter(plant => !withWork(plant)) : [];

	return (
		<div className="border-2 border-rule">
			{/* The parts list's own column heads, in the sheet's grammar. aria-hidden
			    for the reason the job table's are: they are a printed convention, and
			    each row below is a list item carrying its own labelled parts. */}
			<div
				aria-hidden="true"
				className="grid grid-cols-[3.25rem_minmax(0,1fr)] border-b-2 border-rule font-display text-label font-extrabold tracking-widest uppercase"
			>
				<span className="border-r-2 border-rule px-2 py-1.5 text-center">No.</span>
				<span className="px-3 py-1.5">Plant</span>
			</div>

			{/*
			 * The week view leads with the Plants that have work and puts the rest
			 * under a rule. Their numbers do not change: a Plant keeps its number
			 * in both views, so a callout never renumbers under the reader.
			 */}
			<ul aria-label="Plants" className="flex flex-col">
				{ordered.map(plant => (
					<PlantRow
						key={plant.id}
						plant={plant}
						ordinal={ordinals.get(plant.id) ?? 0}
						hovered={hovered === plant.id}
						onHoverChange={onHoverChange}
						onSelect={onSelect}
						lines={lines.get(plant.id) ?? []}
						ruleNames={ruleNames}
						view={view}
					/>
				))}
				{/* A rule across the list, read in place. One list, so its name and
				    its order stay the same thing in both views. */}
				{rest.length > 0 && (
					<li className="border-b-2 border-rule bg-rule-faint/40 px-3 py-1.5 font-display text-label font-extrabold tracking-widest text-muted uppercase">
						Nothing this week
					</li>
				)}
				{rest.map(plant => (
					<PlantRow
						key={plant.id}
						plant={plant}
						ordinal={ordinals.get(plant.id) ?? 0}
						hovered={hovered === plant.id}
						onHoverChange={onHoverChange}
						onSelect={onSelect}
						lines={[]}
						ruleNames={ruleNames}
						view={view}
					/>
				))}
			</ul>
		</div>
	);
}
