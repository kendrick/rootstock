'use client';

import type { ReactElement } from 'react';
import type { Plan } from '@/planner/plan';
import { useEffect, useMemo, useState } from 'react';
import { safeParseArtifact } from '@/artifact/artifact';
import { loadArtifact } from '@/artifact/load';
import { NotLit } from '@/components/this-week/not-lit';
import { onRecorded, recordedDates, weekCounts } from '@/components/this-week/recorded';
import { TallyBand } from '@/components/this-week/tally-band';
import { cn } from '@/lib/utils';
import { seedRules } from '@/seed';
import { listOccurrences, openBrowserStore } from '@/store/browser';
import { Nav } from './nav';

/**
 * The sheet's margin, and what a wide screen is actually for.
 *
 * A single column enlarged is what a phone layout looks like on a desktop, and
 * it was what this shell shipped first: at 1440 the opening screen held a
 * wordmark, a heading and one sentence. The extra width now goes to a margin
 * carrying the week's apparatus, so the work keeps a readable measure while the
 * counts, the region and the rules nothing lit stay in view beside it.
 *
 * It reads the committed Artifact directly rather than taking props. The margin
 * belongs to the shell and renders on every route, and threading the same
 * numbers down from four separate pages would put four copies of this decision
 * in the codebase. A route that cannot parse the Artifact gets a margin holding
 * the wordmark and the nav, which is the honest answer: the page below it is
 * already rendering the error.
 */
function committedPlan(): Plan | null {
	const parsed = safeParseArtifact(loadArtifact().artifact);
	return parsed.ok ? parsed.value.plan : null;
}

const rulesById = new Map(seedRules.map(rule => [rule.id, rule]));

/**
 * How many of the week's Tasks this browser has recorded, or null while that is
 * unknown.
 *
 * Read from the browser Store. A margin that counted nothing recorded would say
 * three open beside a stub saying one of three. The hook re-reads when the Task
 * list says an Occurrence landed, and counts through the same function the list
 * does.
 *
 * Null covers the prerender, the first paint, and a Store that will not open.
 * The page states the last case in words. The margin leaves the Open figure
 * out, because nobody could vouch for the count.
 */
function useRecordedIds(plan: Plan | null): ReadonlySet<string> | null {
	const [recorded, setRecorded] = useState<ReadonlySet<string> | null>(null);

	useEffect(() => {
		if (plan === null) {
			return;
		}

		let live = true;

		async function read(): Promise<void> {
			try {
				const history = await listOccurrences(await openBrowserStore());
				if (live) {
					setRecorded(new Set(recordedDates(plan?.tasks ?? [], history, plan?.asOf ?? '', rulesById).keys()));
				}
			}
			catch {
				if (live) {
					setRecorded(null);
				}
			}
		}

		void read();
		const stop = onRecorded(() => void read());

		return () => {
			live = false;
			stop();
		};
	}, [plan]);

	return recorded;
}

/**
 * The week's counts as this browser knows them, or null before the Store has
 * answered. Shared by the margin and the phone's count beside the heading, so
 * the two can't disagree.
 */
function useWeekCounts(): { plan: Plan; counts: ReturnType<typeof weekCounts>; known: boolean } | null {
	const plan = useMemo(committedPlan, []);
	const recorded = useRecordedIds(plan);

	if (plan === null) {
		return null;
	}

	return { plan, counts: weekCounts(plan.tasks, recorded ?? new Set()), known: recorded !== null };
}

/**
 * The open count set beside the page heading on a phone, where the margin's
 * counts are hidden. It answers "how much is left" without the reader
 * scrolling to the stub. Renders nothing until the Store has answered.
 */
export function OpenCount({ className }: { className?: string }): ReactElement | null {
	const week = useWeekCounts();

	if (week === null || !week.known || week.counts.signable === 0) {
		return null;
	}

	return (
		<p className={cn('font-display text-label font-bold tracking-widest text-foreground uppercase tabular-nums', className)}>
			{`${week.counts.open} of ${week.counts.signable} open`}
		</p>
	);
}

export function RailApparatus(): ReactElement | null {
	const week = useWeekCounts();

	if (week === null) {
		return null;
	}

	const { counts } = week;
	const open = week.known ? counts.open : null;

	/*
	 * A margin block on a wide screen and one compact row on a phone. Stacked at
	 * every width it pushes the page's own heading below the fold, which puts the
	 * week's apparatus ahead of the week itself.
	 */
	return (
		// A landmark, because axe's region rule is right: content loose between the
		// banner and main belongs to nothing, and a screen reader moving by landmark
		// would skip the week's counts entirely. Complementary is the honest role,
		// since these figures support the plan rather than being it.
		<aside
			aria-label="The week at a glance"
			className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 print:hidden sm:mt-6 lg:mt-8 lg:block lg:space-y-3"
		>
			<Nav />

			{/* Off below sm. The band repeats the counts beside it, and on a phone
			    its row is space the first Task needs more. */}
			<div className="hidden w-full sm:block lg:w-auto">
				<TallyBand total={counts.signable} recorded={counts.recorded} />
			</div>

			{/* Off below sm, where `OpenCount` beside the heading carries the one
			    figure a phone reader needs and this row would cost a line. */}
			<dl className="hidden gap-x-6 font-display text-label tracking-widest uppercase sm:flex lg:block lg:space-y-1">
				<div className="flex gap-x-2 lg:justify-between">
					<dt className="text-muted">Tasks</dt>
					<dd className="shrink-0 tabular-nums text-foreground">{counts.signable}</dd>
				</div>
				{open !== null && (
					<div className="flex gap-x-2 lg:justify-between">
						<dt className="text-muted">Open</dt>
						<dd className="shrink-0 tabular-nums text-foreground">{open}</dd>
					</div>
				)}
				{/* Its own line, never folded into Tasks or Open. Approaching work
				    cannot be signed off yet, and counting it as open would keep a
				    finished week open forever. */}
				{counts.approaching > 0 && (
					<div className="flex gap-x-2 lg:justify-between">
						<dt className="text-muted">Approaching</dt>
						<dd className="shrink-0 tabular-nums text-foreground">{counts.approaching}</dd>
					</div>
				)}
			</dl>

		</aside>
	);
}

/**
 * The margin's lower half: the Rules the yard holds that no evidence lit.
 *
 * Separate from the block above so the grid can place it in the margin's second
 * row on a wide screen and after the work on a narrow one. A list of silent
 * Rules belongs beside the plan, and above it on a phone it would be the first
 * thing a reader met.
 */
export function RailNotLit(): ReactElement | null {
	const parsed = safeParseArtifact(loadArtifact().artifact);

	if (!parsed.ok) {
		return null;
	}

	return (
		<div className="mt-8 print:hidden lg:mt-0">
			<NotLit rules={seedRules} tasks={parsed.value.plan.tasks} />
		</div>
	);
}
