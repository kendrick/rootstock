'use client';

import type { ReactElement } from 'react';
import { loadArtifact } from '@/artifact/load';
import { ArtifactGate } from '@/components/artifact-gate';
import { StalenessBanner } from '@/components/staleness-banner';
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
					<h1 className="text-2xl font-medium tracking-tight text-foreground">This Week</h1>

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
