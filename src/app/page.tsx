'use client';

import type { ReactElement } from 'react';
import { loadArtifact } from '@/artifact/load';
import { ArtifactGate } from '@/components/artifact-gate';
import { FirstVisitBand } from '@/components/shell/first-visit-band';
import { OpenCount } from '@/components/shell/rail';
import { StalenessBanner } from '@/components/staleness-banner';
import { Purpose } from '@/components/this-week/purpose';
import { ThisWeek } from '@/components/this-week/this-week';
import { seedPlants, seedRules } from '@/seed';

/**
 * The route itself is the client boundary because `ArtifactGate` takes a render
 * prop, and a function cannot be handed from a server component to a client
 * one. A wrapper whose only job was to hold that arrow function would buy
 * nothing, since `output: 'export'` bundles the Artifact for the browser either
 * way.
 *
 * The Artifact, the rule set, and the inventory are all read here and passed
 * down. `ThisWeek` defaults the last two, and the route still names them: the
 * Artifact cites Rules by id, so what those ids resolve against is part of what
 * the page is showing, and a component reaching for the seed on its own would
 * hide that. The loader is the one import that may not move below the route:
 * the gate is the only caller allowed to turn the committed JSON into an
 * Artifact.
 */
export default function ThisWeekPage(): ReactElement {
	const { artifact, status } = loadArtifact();

	return (
		<ArtifactGate artifact={artifact} status={status}>
			{validated => (
				<div className="space-y-6">
					<FirstVisitBand />

					<div className="space-y-3">
						<div className="flex items-baseline justify-between gap-4">
							<h1 className="font-display text-display leading-none font-bold tracking-tight text-foreground uppercase outline-none">This Week</h1>
							<OpenCount className="sm:hidden" />
						</div>

						{/*
						 * Above the first task and above the banner. #50 graded this
						 * route against a brief asking that the page say what it is
						 * before it says what to do, and anything below the first task
						 * fails that on position however well it is written.
						 *
						 * Authored copy, never `narration.summary`, which `ThisWeek`
						 * renders in a slot below. The model can say what the week
						 * holds and never what the page is.
						 */}
						<Purpose planned={validated.artifact.plan.asOf} />
					</div>

					<StalenessBanner
						generatedAt={validated.artifact.generatedAt}
						status={validated.status}
					/>

					<ThisWeek
						artifact={validated.artifact}
						status={validated.status}
						rules={seedRules}
						plants={seedPlants}
					/>
				</div>
			)}
		</ArtifactGate>
	);
}
