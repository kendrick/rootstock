'use client';

import type { ReactElement } from 'react';
import { loadArtifact } from '@/artifact/load';
import { ArtifactGate } from '@/components/artifact-gate';
import { StalenessBanner } from '@/components/staleness-banner';

/**
 * A placeholder route that still validates its data and still reports its age,
 * because the shell makes both promises on every route, including the ones
 * nobody has filled in yet. #14 replaces the line below, not the wiring around
 * it.
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

					<p className="text-muted-foreground">
						Every Rule goes here, with the region it covers and where it came from.
					</p>
				</div>
			)}
		</ArtifactGate>
	);
}
