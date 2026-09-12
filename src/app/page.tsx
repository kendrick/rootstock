'use client';

import type { ReactElement } from 'react';
import { loadArtifact } from '@/artifact/load';
import { ArtifactGate } from '@/components/artifact-gate';
import { StalenessBanner } from '@/components/staleness-banner';

/**
 * The route itself is the client boundary because `ArtifactGate` takes a render
 * prop, and a function cannot be handed from a server component to a client
 * one. A wrapper whose only job was to hold that arrow function would buy
 * nothing, since `output: 'export'` bundles the Artifact for the browser either
 * way.
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

					{/* One line and no more. #12 owns what actually renders under this
					    heading, and anything added here is work it would have to undo. */}
					<p className="text-muted-foreground">
						The Plan for this week goes here, each Task beside the Citation behind it.
					</p>
				</div>
			)}
		</ArtifactGate>
	);
}
