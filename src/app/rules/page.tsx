'use client';

import type { ReactElement } from 'react';
import { loadArtifact } from '@/artifact/load';
import { ArtifactGate } from '@/components/artifact-gate';
import { RuleList } from '@/components/rules/rule-list';
import { StalenessBanner } from '@/components/staleness-banner';
import { seedRules } from '@/seed';

/**
 * Every Rule the planner uses, with Guards grouped last. The route owns the
 * only h1; RuleList owns the Guards h2; RuleSummary owns no heading at all.
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

					<RuleList rules={seedRules} />
				</div>
			)}
		</ArtifactGate>
	);
}
