'use client';

import type { ReactElement } from 'react';
import { loadArtifact } from '@/artifact/load';
import { ArtifactGate } from '@/components/artifact-gate';
import { BandIndex } from '@/components/rules/band-index';
import { drawnBands } from '@/components/rules/bands';
import { NarrationLine } from '@/components/rules/narration-line';
import { RuleList } from '@/components/rules/rule-list';
import { rankRules } from '@/components/rules/waiting';
import { StalenessBanner } from '@/components/staleness-banner';
import { seedRules } from '@/seed';

/**
 * Every Rule the planner uses, banded by how close it is to producing work,
 * with Guards last. The route owns the only h1; RuleList owns a section h2 per
 * band, plus an h3 naming each Rule (RuleSummary's `asHeading`); RuleSummary
 * renders no heading of its own otherwise.
 *
 * The route itself is the client boundary because `ArtifactGate` takes a render
 * prop, and a function cannot be handed from a server component to a client one.
 */
export default function RulesPage(): ReactElement {
	const { artifact, status } = loadArtifact();

	return (
		<ArtifactGate artifact={artifact} status={status}>
			{validated => (
				<div className="space-y-6">
					<h1 className="font-display text-display leading-none font-extrabold tracking-tight text-foreground uppercase">Rules</h1>

					<p className="max-w-prose text-body text-foreground">
						Every Rule the yard holds is here, sorted into bands in the order you&apos;d ask about them: what fired this week, what&apos;s forecast to, what&apos;s waiting, and last the Guards, which create no work. Each Rule&apos;s status line adds only what its band doesn&apos;t say, like the day its window closes.
					</p>

					<BandIndex bands={drawnBands(rankRules(seedRules, validated.artifact.plan))} />

					<StalenessBanner
						generatedAt={validated.artifact.generatedAt}
						status={validated.status}
					/>

					<NarrationLine status={validated.status} />

					<RuleList rules={seedRules} plan={validated.artifact.plan} />
				</div>
			)}
		</ArtifactGate>
	);
}
