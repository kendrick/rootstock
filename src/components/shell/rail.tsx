'use client';

import type { ReactElement } from 'react';
import { safeParseArtifact } from '@/artifact/artifact';
import { loadArtifact } from '@/artifact/load';
import { NotLit } from '@/components/this-week/not-lit';
import { TallyBand } from '@/components/this-week/tally-band';
import { seedRules } from '@/seed';
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
function weekCounts(): { total: number; recorded: number } | null {
	const parsed = safeParseArtifact(loadArtifact().artifact);

	if (!parsed.ok) {
		return null;
	}

	// Recorded is derived from the browser's own Occurrence history on This Week,
	// and the margin has no access to it here. The band shows the week's shape,
	// and the page below it is where a tick lands.
	return { total: parsed.value.plan.tasks.length, recorded: 0 };
}

export function RailApparatus(): ReactElement | null {
	const counts = weekCounts();

	if (counts === null) {
		return null;
	}

	const open = counts.total - counts.recorded;

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
			className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 print:hidden lg:mt-8 lg:block lg:space-y-3"
		>
			<Nav />

			<div className="w-full lg:w-auto">
				<TallyBand total={counts.total} recorded={counts.recorded} />
			</div>

			<dl className="flex gap-x-6 font-display text-label tracking-widest uppercase lg:block lg:space-y-1">
				<div className="flex gap-x-2 lg:justify-between">
					<dt className="text-muted">Jobs</dt>
					<dd className="shrink-0 tabular-nums text-foreground">{counts.total}</dd>
				</div>
				<div className="flex gap-x-2 lg:justify-between">
					<dt className="text-muted">Open</dt>
					<dd className="shrink-0 tabular-nums text-accent">{open}</dd>
				</div>
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
