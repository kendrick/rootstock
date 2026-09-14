'use client';

import type { ReactElement } from 'react';
import { loadArtifact } from '@/artifact/load';
import { ArtifactGate } from '@/components/artifact-gate';
import { RuleList } from '@/components/rules/rule-list';
import { StalenessBanner } from '@/components/staleness-banner';
import { seedRules } from '@/seed';

/**
 * Every Rule the planner uses, grouped by kind with Guards last. The route
 * owns the only h1; RuleList owns a section h2 per kind, plus an h3 naming
 * each Rule (RuleSummary's `asHeading`); RuleSummary renders no heading of
 * its own otherwise.
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
					<h1 className="text-2xl font-medium tracking-tight text-foreground">Rules</h1>

					<StalenessBanner
						generatedAt={validated.artifact.generatedAt}
						status={validated.status}
					/>

					<RuleList rules={seedRules} plan={validated.artifact.plan} />
				</div>
			)}
		</ArtifactGate>
	);
}
