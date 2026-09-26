'use client';

import type { ReactElement, ReactNode } from 'react';
import type { Artifact } from '@/artifact/artifact';
import type { Occurrence } from '@/planner/occurrence';
import type { Citation } from '@/planner/task';
import type { GuardRule, Rule, ThresholdRule } from '@/rules/rule';
import type { Store } from '@/store/store';
import type { Irrigation, Plant } from '@/yard/plant';
import { useEffect, useRef, useState } from 'react';
import { SourceBadge } from '@/components/source-badge';
import { ticketAnchor } from '@/components/this-week/ticket-anchor';
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import { withBasePath } from '@/lib/base-path';
import { seedYard } from '@/seed';
import { listOccurrences, openBrowserStore } from '@/store/browser';
import { rulesFor } from './applicable-rules';
import { SoilSparkline } from './soil-sparkline';
import { ticketLabel, ticketLines } from './week-work';

/**
 * The same four words `plant-list.tsx` prints, deliberately duplicated. The note
 * there carries the reasoning and the alternative that was turned down. Edit the
 * two together.
 */
const KIND_TEXT: Record<Plant['kind'], string> = {
	plant: 'Plant',
	container: 'Container',
	bed: 'Bed',
	lawn: 'Lawn',
};

/**
 * `irrigationSchema` keeps `source` so an owner's stated claim stays separable
 * from a measured one, so the schedule never renders without it. A schedule
 * somebody typed from memory and one a controller reported are different
 * evidence, and the difference is invisible once the words are on the page.
 */
const IRRIGATION_SOURCE_TEXT: Record<Irrigation['source'], string> = {
	asserted: 'As the owner describes it, not measured.',
	rachio: 'As reported by Rachio.',
};

/**
 * A Guard creates no work (CONTEXT.md). It reaches this plant to hold work back
 * or to mark it up, never to ask for anything. Saying which of the two it does
 * is the whole marker, because "deferred until Friday" and "go ahead, but in
 * the evening" are different news to a reader scanning what governs a plant.
 */
const GUARD_EFFECT_TEXT: Record<GuardRule['effect'], string> = {
	// "Can", because the list says what a Guard is able to do here, not what
	// it is doing today. Whether it holds anything this week is on the ticket.
	defer: 'Guard · can hold work back',
	annotate: 'Guard · can add a note',
};

/** A section's head, ruled like the parts list's column heads. */
function SectionHead({ children }: { children: ReactNode }): ReactElement {
	return (
		<h3 className="border-y-2 border-rule py-1.5 font-display text-label font-extrabold tracking-widest text-foreground uppercase">
			{children}
		</h3>
	);
}

/** Pinned rather than left to the visitor's locale, matching `StalenessBanner`. Every other string here is hand-written English. */
const AREA_FORMAT = new Intl.NumberFormat('en-US');
// UTC, because an Occurrence's `completedAt` is a UTC instant and the day it
// names is the UTC day. Left to the visitor's zone, 2026-06-01T00:00Z prints
// as May 31 anywhere west of Greenwich. `soil-sparkline.tsx` pins UTC for the
// same reason.
const RECORDED_DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

/**
 * What the store said about this plant's Occurrences, carrying the plant it was
 * read for.
 *
 * The plant id rides along so a sheet reopened on a second plant renders its
 * loading state instead of the first plant's history. Without it, the rows for
 * the plant before sit on screen until the new read lands, reading as an answer.
 */
type History
	= | { status: 'loaded'; plantId: string; occurrences: Occurrence[] }
		| { status: 'failed'; plantId: string; message: string };

export interface PlantSheetProps {
	/** The Plant to show, or null for a closed sheet. */
	plant: Plant | null;
	rules: Rule[];
	/** The whole inventory, not just this Plant. `rulesFor` resolves a tag selector against every Plant before asking whether this one is in the result. */
	plants: Plant[];
	artifact: Artifact;
	/**
	 * Where this Plant's Occurrences are read from. Omit it and the sheet reads
	 * the browser store, which is what the route wants. A spec passes
	 * `createYardStore()` instead of standing up IndexedDB.
	 */
	store?: Store;
	onOpenChange: (open: boolean) => void;
	/**
	 * Radix restores focus to whatever it recorded as the trigger, but this
	 * sheet has two: a photo pin and a list row can both open it for the same
	 * Plant. Only the caller knows which one actually fired, so it supplies
	 * this instead of the sheet guessing.
	 */
	onCloseAutoFocus?: (event: Event) => void;
}

function Detail({ label, children }: { label: string; children: ReactNode }): ReactElement {
	return (
		<div className="space-y-1">
			<dt className="font-display text-label font-extrabold tracking-widest text-muted uppercase">{label}</dt>
			<dd className="font-mono text-evidence text-foreground">{children}</dd>
		</div>
	);
}

/**
 * Everything the inventory records about where this Plant lives.
 *
 * The site, the notes and the lawn detail are all nullable, and a null renders
 * as nothing at all—no dash, no "unknown". A placeholder claims it was asked
 * and came back empty, where the truth is that nobody has written it down, and
 * the two lead a reader to different next steps.
 */
function SiteConditions({ plant }: { plant: Plant }): ReactElement {
	const { lawn } = plant;

	return (
		<dl className="grid gap-4 sm:grid-cols-2">
			{plant.site !== null && <Detail label="Site">{plant.site}</Detail>}

			{/* Tags are how a Rule selects a Plant, so the label says that rather
			    than naming the field. A planned Plant's `planned` tag is left off:
			    the line under the name already says so. */}
			{shownTags(plant).length > 0 && (
				<Detail label="Rules find it by">{shownTags(plant).join(', ')}</Detail>
			)}

			{plant.notes !== null && <Detail label="Notes">{plant.notes}</Detail>}

			{lawn !== null && (
				<>
					<Detail label="Grass">{lawn.grass}</Detail>
					<Detail label="Area">{`${AREA_FORMAT.format(lawn.areaSqFt)} sq ft`}</Detail>
					<Detail label="Soil">{lawn.soil}</Detail>
					<Detail label="Irrigation">
						{lawn.irrigation.schedule}
						<span className="mt-1 block font-display font-semibold text-label tracking-widest text-muted uppercase">
							{IRRIGATION_SOURCE_TEXT[lawn.irrigation.source]}
						</span>
					</Detail>
				</>
			)}
		</dl>
	);
}

/**
 * One Rule, compact: what it is called, where it came from, the region it
 * applies to, and whether it is a Guard.
 *
 * This row is local rather than an import. Contract 11 of the plan
 * allocated `rule-summary.tsx` to #12 and named #14 as the only other ticket
 * that reuses it; #13 was never allocated that component, so this sheet renders
 * its own presentation instead of importing or duplicating a sibling's file.
 *
 * The needs here are also genuinely narrower than the full summary—no
 * threshold value with its published range, no product label link, no delegable
 * flag—because this sheet answers one question, "which Rules reach this
 * Plant", and those three belong to the question of what the work is. Staying
 * separate may well be the right end state. Consolidating is a candidate to
 * weigh once #12 and #14 have both landed and all three presentations can be
 * read side by side, not a commitment made here.
 */
function RuleRow({ rule, children }: { rule: Rule; children?: ReactNode }): ReactElement {
	return (
		<li className="space-y-2 border-b-2 border-rule px-3 py-3 last:border-b-0">
			<p className="font-display text-body font-extrabold tracking-wide text-foreground uppercase">{rule.name}</p>
			<div className="flex flex-wrap items-center gap-2">
				<SourceBadge source={rule.source} />
				{/* Printed on the form, not a pill: this world has no rounded marks. */}
				{rule.kind === 'guard' && (
					<span className="border border-foreground px-1 font-display text-label font-extrabold tracking-widest text-foreground uppercase">
						{GUARD_EFFECT_TEXT[rule.effect]}
					</span>
				)}
				{/* The same mark This Week's row carries, for the same household
				    reader. A Guard makes no work, so it has nothing to delegate. */}
				{rule.kind !== 'guard' && !rule.delegable && (
					<span className="border border-foreground px-1 font-display text-label font-extrabold tracking-widest text-foreground uppercase">
						Not delegable
					</span>
				)}
				{/* Only where it differs. Every Rule in the set today is written for
				    the yard's own region, which the ticket head already names. */}
				{rule.region.name !== seedYard.region.name && (
					<span className="font-display font-semibold text-label tracking-widest text-muted uppercase">{rule.region.name}</span>
				)}
			</div>
			{children}
		</li>
	);
}

function RuleList({ rules, renderExtra }: { rules: Rule[]; renderExtra?: (rule: Rule) => ReactNode }): ReactElement {
	return (
		<ul className="flex flex-col border-2 border-rule">
			{rules.map(rule => (
				<RuleRow key={rule.id} rule={rule}>{renderExtra?.(rule)}</RuleRow>
			))}
		</ul>
	);
}

function shownTags(plant: Plant): string[] {
	return plant.status === 'planned' ? plant.tags.filter(tag => tag !== 'planned') : plant.tags;
}

/**
 * Why no Rule reaches this Plant, in the two ways that can happen. A planned
 * Plant waits to be planted (`targets()` drops it until then). A planted Plant
 * no Rule reaches will never get a Task at all, which is open issue #52.
 * "Reaches", because a Rule can select a Plant by tag without naming it.
 */
function noRuleText(plant: Plant): string {
	return plant.status === 'planned'
		? 'Not in the ground yet. Rules reach a plant once it is planted.'
		: 'No Rule reaches this plant, so the Planner will never give it a Task.';
}

/**
 * The Rule an Occurrence belongs to, by name where the Rule is still in the set
 * and by id where it is not. An Occurrence is append-only and outlives the Rule
 * that produced it, so a deleted Rule leaves the id as the only honest label.
 */
function ruleLabel(ruleId: string, rules: Rule[]): string {
	return rules.find(rule => rule.id === ruleId)?.name ?? ruleId;
}

/**
 * What has actually been done to this Plant. CONTEXT.md's Occurrence entry puts
 * Completion on its _Avoid_ line, which is why nothing here is headed
 * "completion history". These are records that work happened, not boxes that
 * got ticked.
 *
 * Each of the four states says something different on purpose. A Plant nobody
 * has touched and a Plant whose history could not be read must not look alike—the
 * first is a fact about the yard and the second is a fault in the browser, and
 * one empty list would tell a reader the wrong one.
 */
function RecordedWork({ history, rules }: { history: History | null; rules: Rule[] }): ReactElement {
	if (history === null) {
		return <p className="text-body text-muted">Reading recorded work…</p>;
	}

	// The reason stays out of the sentence. It is a browser's error string, and
	// the reader can act on what it means, not on what it says.
	if (history.status === 'failed') {
		return (
			<p className="text-body text-muted">
				This browser won't open its record of finished work, so what was recorded here can't be shown. Private windows do this.
			</p>
		);
	}

	if (history.occurrences.length === 0) {
		return <p className="text-body text-muted">Nothing has been recorded against this plant yet.</p>;
	}

	return (
		<ul className="flex flex-col gap-2">
			{history.occurrences.map(occurrence => (
				<li key={occurrence.id} className="flex flex-wrap items-baseline gap-x-2 text-body">
					<time dateTime={occurrence.completedAt} className="font-mono text-foreground">
						{RECORDED_DATE_FORMAT.format(Date.parse(occurrence.completedAt))}
					</time>
					<span className="text-muted">{ruleLabel(occurrence.ruleId, rules)}</span>
				</li>
			))}
		</ul>
	);
}

/**
 * Everything the yard knows about one Plant: where it sits, which Rules reach
 * it, what has been recorded against it, and—where a Threshold Rule reaches
 * it—the series that Rule reads.
 *
 * Open is derived from `plant` rather than held as a second piece of state. Two
 * sources of truth for "is this open" is how a sheet ends up open with nothing
 * in it.
 */
export function PlantSheet({
	plant,
	rules,
	plants,
	artifact,
	store,
	onOpenChange,
	onCloseAutoFocus,
}: PlantSheetProps): ReactElement {
	const [history, setHistory] = useState<History | null>(null);

	// The critique measured focus landing on the fourth of five focusables on
	// open, roughly 500px below the fold with nothing on screen to say focus
	// had moved at all. The heading is the one thing every opening of this
	// sheet has in common, sighted or not, so onOpenAutoFocus is overridden to
	// land there instead of wherever Radix's own tab-order scan happens to stop.
	const titleRef = useRef<HTMLHeadingElement>(null);

	// The id and not the record: a parent that rebuilt an equal Plant object on
	// every render would otherwise re-read the store on every render with it.
	const plantId = plant?.id ?? null;

	useEffect(() => {
		if (plantId === null) {
			return;
		}

		// The store's default is resolved here rather than in the parameter list,
		// because `openBrowserStore()` is async and there is no synchronous browser
		// store to default to. It is also the only place it can be called at all:
		// `next.config.ts` sets `output: 'export'`, so every route prerenders in
		// Node where `globalThis.indexedDB` does not exist (see the docblock on
		// `openBrowserStore`). An effect never runs in that prerender.
		let current = true;

		(store === undefined ? openBrowserStore() : Promise.resolve(store))
			.then(listOccurrences)
			.then((occurrences) => {
				if (!current) {
					return;
				}
				setHistory({
					status: 'loaded',
					plantId,
					occurrences: occurrences
						.filter(occurrence => occurrence.plantId === plantId)
						.sort((left, right) => right.completedAt.localeCompare(left.completedAt)),
				});
			})
			.catch((cause: unknown) => {
				// A rejection here is IndexedDB refusing to open—a private window, a
				// browser with storage off. Letting it escape would take the whole
				// sheet down over a section of it, so it lands in the render instead.
				if (!current) {
					return;
				}
				setHistory({
					status: 'failed',
					plantId,
					message: cause instanceof Error ? cause.message : String(cause),
				});
			});

		return () => {
			current = false;
		};
	}, [plantId, store]);

	const applicable = plant === null ? [] : rulesFor(plant, rules, plants);

	/*
	 * The first Threshold Rule that reaches this Plant, or none. No Threshold
	 * Rule means no chart at all rather than an empty frame: a sparkline drawn
	 * for a Plant no Threshold Rule reaches would have no threshold to draw
	 * across it, which is the only line on it that means anything.
	 */
	const thresholdRule: ThresholdRule | null
		= applicable.find((rule): rule is ThresholdRule => rule.kind === 'threshold') ?? null;
	const workRules = applicable.filter(rule => rule.kind !== 'guard');
	const onTicket = plant === null ? [] : (ticketLines(artifact.plan.tasks).get(plant.id) ?? []);
	const guards = applicable.filter(rule => rule.kind === 'guard');

	/*
	 * The Citation off this Rule's Task for this Plant. Both halves of the key
	 * have to match: the Planner writes one Task per (Rule, Plant) pair, so
	 * matching on `ruleId` alone would mark the lawn's crossing day on a chart
	 * opened from another Plant the same Rule reaches.
	 */
	const citation: Citation | null
		= thresholdRule === null || plant === null
			? null
			: artifact.plan.tasks.find(
				task => task.ruleId === thresholdRule.id && task.plantId === plant.id,
			)?.citation ?? null;

	return (
		<Sheet open={plant !== null} onOpenChange={onOpenChange}>
			{plant !== null && (
				<SheetContent
					// The sheet slides in from the edge rather than appearing. It is the one
					// place on this surface where something arrives over the page, and a
					// panel that pops gives a reader no sense of where it came from or
					// where it will go back to.
					//
					// Faster than shadcn's defaults, which run 500ms in and 300ms out: this
					// world's other motion is a stamp at 140ms, and a half-second slide
					// beside it reads as a different product. Out is quicker than in,
					// because leaving needs no explaining.
					//
					// Ruled and flat, like the sheet it covers: a border rather than the
					// default shadow, since nothing in this world sits on a raised surface.
					className="w-full overflow-y-auto border-l-2 border-rule shadow-none duration-200 data-[state=closed]:duration-150 sm:max-w-lg"
					aria-modal="true"
					onOpenAutoFocus={(event) => {
						event.preventDefault();
						titleRef.current?.focus();
					}}
					onCloseAutoFocus={onCloseAutoFocus}
				>
					<SheetHeader>
						{/*
							tabIndex makes an h2 focusable without adding it to the tab
							order: nothing needs to reach it by Tab, but onOpenAutoFocus
							above needs somewhere to send focus that isn't a random control
							several sections down.
						*/}
						<SheetTitle ref={titleRef} tabIndex={-1}>{plant.name}</SheetTitle>
						{/* Planned status here too, not only on the row that opened this:
						    the description is what a screen reader announces with the
						    dialog, and "Plant" alone tells it nothing. */}
						<SheetDescription>
							{[plant.status === 'planned' ? 'Planned' : null, KIND_TEXT[plant.kind], plant.site].filter(part => part !== null).join(' · ')}
						</SheetDescription>
					</SheetHeader>

					<div className="mt-6 space-y-6">
						<section className="space-y-3">
							<SectionHead>Site conditions</SectionHead>
							<SiteConditions plant={plant} />
						</section>

						{/*
							Rules that ask for work and Guards that can hold it back are
							different news, so they are listed apart. Both sections stay when
							empty only where the empty state says something true.
						*/}
						<section className="space-y-3">
							<SectionHead>Rules that ask for work here</SectionHead>
							{workRules.length === 0
								// Ink for a planted Plant, because it's the gap #52 names and the
								// one thing on this sheet that asks the owner for something.
								? <p className={plant.status === 'planned' ? 'text-body text-muted' : 'text-body text-foreground'}>{noRuleText(plant)}</p>
								: (
										<RuleList
											rules={workRules}
											// The chart sits in its own Rule's row, so it is read as that
											// Rule's evidence and not as the Plant's.
											renderExtra={rule => (
												<>
													{/* Which Rules are live this week, and where on the
													    ticket their Task is. */}
													{onTicket.filter(line => line.ruleId === rule.id).map(line => (
														// A plain link rather than next/link, because a client-side hop
														// pushes history without updating `:target`, so the row would
														// never mark itself and the browser wouldn't scroll to it.
														<a
															key={`${line.group}-${line.ordinal}`}
															href={withBasePath(`/#${ticketAnchor(line.group, line.ordinal)}`)}
															className="inline-flex min-h-11 items-center font-display text-label font-extrabold tracking-widest text-foreground uppercase underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
														>
															{`On this week's ticket · ${ticketLabel(line)}`}
														</a>
													))}
													{rule.id === thresholdRule?.id && (
														<SoilSparkline
															window={artifact.plan.window}
															rule={thresholdRule}
															citation={citation}
															asOf={artifact.plan.asOf}
														/>
													)}
												</>
											)}
										/>
									)}
						</section>

						{guards.length > 0 && (
							<section className="space-y-3">
								<SectionHead>Guards that can hold it back or add a note</SectionHead>
								<p className="text-note text-muted">
									A Guard creates no work. It can hold a Task back until its condition clears, or add a note to one.
								</p>
								<RuleList rules={guards} />
							</section>
						)}

						<section className="space-y-3">
							<SectionHead>Recorded work</SectionHead>
							<RecordedWork
								history={history !== null && history.plantId === plant.id ? history : null}
								rules={rules}
							/>
						</section>

						{/* A second way out at the foot on a phone, where the sheet is full
						    width, there is no backdrop to tap, and the top corner is the
						    last place a one-handed thumb reaches. */}
						<SheetClose className="inline-flex min-h-11 w-full items-center justify-center border-2 border-rule font-display text-label font-extrabold tracking-widest text-foreground uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden">
							Close
						</SheetClose>
					</div>
				</SheetContent>
			)}
		</Sheet>
	);
}
