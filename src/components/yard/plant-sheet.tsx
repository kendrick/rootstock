'use client';

import type { ReactElement, ReactNode } from 'react';
import type { Artifact } from '@/artifact/artifact';
import type { Occurrence } from '@/planner/occurrence';
import type { Citation } from '@/planner/task';
import type { GuardRule, Rule, ThresholdRule } from '@/rules/rule';
import type { Store } from '@/store/store';
import type { Irrigation, Plant } from '@/yard/plant';
import { useEffect, useState } from 'react';
import { SourceBadge } from '@/components/source-badge';
import { Badge } from '@/components/ui/badge';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import { listOccurrences, openBrowserStore } from '@/store/browser';
import { rulesFor } from './applicable-rules';
import { SoilSparkline } from './soil-sparkline';

/** The word for each `kind`, rendered on the page. `plant-list.tsx` keeps its own copy and exports none; four words are cheaper duplicated than coupled across two components. */
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
	defer: 'Guard · holds work back',
	annotate: 'Guard · adds a note',
};

/** Pinned rather than left to the visitor's locale, matching `StalenessBanner`. Every other string here is hand-written English. */
const AREA_FORMAT = new Intl.NumberFormat('en-US');
const RECORDED_DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

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
}

function Detail({ label, children }: { label: string; children: ReactNode }): ReactElement {
	return (
		<div className="space-y-1">
			<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
			<dd className="text-sm text-foreground">{children}</dd>
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

			{plant.tags.length > 0 && (
				<Detail label="Tags">
					<div className="flex flex-wrap gap-1.5">
						{plant.tags.map(tag => (
							<Badge key={tag} variant="secondary">{tag}</Badge>
						))}
					</div>
				</Detail>
			)}

			{plant.notes !== null && <Detail label="Notes">{plant.notes}</Detail>}

			{lawn !== null && (
				<>
					<Detail label="Grass">{lawn.grass}</Detail>
					<Detail label="Area">{`${AREA_FORMAT.format(lawn.areaSqFt)} sq ft`}</Detail>
					<Detail label="Soil">{lawn.soil}</Detail>
					<Detail label="Irrigation">
						{lawn.irrigation.schedule}
						<span className="mt-1 block text-xs text-muted-foreground">
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
function RuleRow({ rule }: { rule: Rule }): ReactElement {
	return (
		<li className="space-y-2 border-b border-border px-3 py-2.5 last:border-b-0">
			<p className="text-sm font-semibold text-foreground">{rule.name}</p>
			<div className="flex flex-wrap items-center gap-2">
				<SourceBadge source={rule.source} />
				{rule.kind === 'guard' && (
					<Badge variant="outline">{GUARD_EFFECT_TEXT[rule.effect]}</Badge>
				)}
				<span className="text-xs text-muted-foreground">{rule.region.name}</span>
			</div>
		</li>
	);
}

function ApplicableRules({ rules }: { rules: Rule[] }): ReactElement {
	// Reachable from two directions: a planned Plant, which `targets()` drops
	// until it is in the ground, and a planted one no Rule happens to name.
	if (rules.length === 0) {
		return <p className="text-sm text-muted-foreground">No Rule reaches this plant.</p>;
	}

	return (
		<ul className="flex flex-col rounded-md border border-border">
			{rules.map(rule => (
				<RuleRow key={rule.id} rule={rule} />
			))}
		</ul>
	);
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
		return <p className="text-sm text-muted-foreground">Reading what has been recorded here…</p>;
	}

	if (history.status === 'failed') {
		return (
			<p className="text-sm text-muted-foreground">
				{`What has been recorded here could not be read. ${history.message}`}
			</p>
		);
	}

	if (history.occurrences.length === 0) {
		return <p className="text-sm text-muted-foreground">Nothing has been recorded against this plant yet.</p>;
	}

	return (
		<ul className="flex flex-col gap-2">
			{history.occurrences.map(occurrence => (
				<li key={occurrence.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
					<time dateTime={occurrence.completedAt} className="font-medium text-foreground">
						{RECORDED_DATE_FORMAT.format(Date.parse(occurrence.completedAt))}
					</time>
					<span className="text-muted-foreground">{ruleLabel(occurrence.ruleId, rules)}</span>
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
}: PlantSheetProps): ReactElement {
	const [history, setHistory] = useState<History | null>(null);

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
				<SheetContent className="w-full overflow-y-auto sm:max-w-lg">
					<SheetHeader>
						<SheetTitle>{plant.name}</SheetTitle>
						<SheetDescription>{KIND_TEXT[plant.kind]}</SheetDescription>
					</SheetHeader>

					<div className="mt-6 space-y-6">
						<section className="space-y-3">
							<h3 className="text-sm font-semibold text-foreground">Site conditions</h3>
							<SiteConditions plant={plant} />
						</section>

						<section className="space-y-3">
							<h3 className="text-sm font-semibold text-foreground">Rules that reach this plant</h3>
							<ApplicableRules rules={applicable} />
							{thresholdRule !== null && (
								<SoilSparkline
									window={artifact.plan.window}
									rule={thresholdRule}
									citation={citation}
								/>
							)}
						</section>

						<section className="space-y-3">
							<h3 className="text-sm font-semibold text-foreground">Recorded work</h3>
							<RecordedWork
								history={history !== null && history.plantId === plant.id ? history : null}
								rules={rules}
							/>
						</section>
					</div>
				</SheetContent>
			)}
		</Sheet>
	);
}
